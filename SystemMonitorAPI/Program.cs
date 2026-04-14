using Hangfire;
using Hangfire.Oracle.Core;
using Microsoft.EntityFrameworkCore;
using Quartz;
using System.Data;
using System.Text.Json.Serialization;
using SystemMonitorAPI.Configuration;
using SystemMonitorAPI.Filters;
using SystemMonitorAPI.Jobs;
using SystemMonitorAPI.Model;
using SystemMonitorAPI.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Controllers ──────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        o.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
        o.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// ── Oracle DB ────────────────────────────────────────────────
var connectionString = builder.Configuration
    .GetConnectionString("SystemMonitorDefaultConnection");

builder.Services.AddDbContext<SystemMonitorContext>(
    options =>
    {
        options.UseOracle(connectionString,
            o => o.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19));
        options.UseLazyLoadingProxies();
    },
    contextLifetime: ServiceLifetime.Scoped,
    optionsLifetime: ServiceLifetime.Singleton);

builder.Services.AddDbContextFactory<SystemMonitorContext>(options =>
{
    options.UseOracle(connectionString,
        o => o.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19));
    options.UseLazyLoadingProxies();
});

// ── Hangfire — store jobs in Oracle ─────────────────────────
builder.Services.AddHangfire(config => config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()
    .UseRecommendedSerializerSettings()
    .UseStorage(new OracleStorage(
        builder.Configuration.GetConnectionString("SystemMonitorDefaultConnection"),
        new OracleStorageOptions
        {
            TransactionIsolationLevel = IsolationLevel.ReadCommitted,
            QueuePollInterval = TimeSpan.FromSeconds(15),
            JobExpirationCheckInterval = TimeSpan.FromHours(1),
            CountersAggregateInterval = TimeSpan.FromMinutes(5),
            PrepareSchemaIfNecessary = false,
            DashboardJobListLimit = 50000,
            TransactionTimeout = TimeSpan.FromMinutes(1),
            SchemaName = "ssysmonitor"
        })));

builder.Services.AddHangfireServer(options =>
{
    options.WorkerCount = 2;
});

// ── HTTP Clients ─────────────────────────────────────────────
builder.Services.AddHttpClient<INvdService, NvdService>(client =>
{
    client.DefaultRequestHeaders.Add("User-Agent", "SystemMonitorAPI");
});

// Long timeout for the ~1 GB CVE zip download
builder.Services.AddHttpClient("cve-local", c =>
{
    c.Timeout = TimeSpan.FromMinutes(30);
});

#region switch
// ── 2. Network scan configuration ─────────────────────────────────────────────
var scanConfig = builder.Configuration
    .GetSection("NetworkScan")
    .Get<NetworkScanConfig>();

builder.Services.Configure<NetworkScanConfig>(
    builder.Configuration.GetSection("NetworkScan"));

// ── 3. SNMP + scan services ───────────────────────────────────────────────────
builder.Services.AddScoped<ISnmpV3Service, SnmpV3Service>();
builder.Services.AddScoped<INetworkScanService, NetworkScanService>();
builder.Services.AddScoped<IDevicePortResolutionService, DevicePortResolutionService>();

// ── 4. Quartz scheduled scanner ───────────────────────────────────────────────
builder.Services.AddQuartz(q =>
{
    q.UseMicrosoftDependencyInjectionJobFactory();

    var jobKey = new JobKey("NetworkScanJob");

    q.AddJob<NetworkScanJob>(opts => opts.WithIdentity(jobKey));

    q.AddTrigger(opts => opts
        .ForJob(jobKey)
        .WithIdentity("NetworkScanTrigger")
        .WithSimpleSchedule(s => s
            .WithIntervalInMinutes(
                builder.Configuration.GetValue<int>("NetworkScan:ScanIntervalMinutes"))
            .RepeatForever())
        .StartAt(DateTimeOffset.Now.AddMinutes(2))
    );
});

// ── 5. CORS (adjust origins for production) ──────────────────────────────────
builder.Services.AddCors(opt => opt.AddDefaultPolicy(policy =>
    policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));



#endregion



// ── App Services ─────────────────────────────────────────────
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddSingleton<CredentialService>();
builder.Services.AddScoped<IVulnerabilityScanService, VulnerabilityScanService>();
builder.Services.AddScoped<IVulnerabilityEngine, VulnerabilityEngine>();

// Singleton — in-memory CVE index is built once and reused across all requests
builder.Services.AddSingleton<ICveLocalService, CveLocalService>();

// Hangfire job classes — must be concrete, never interfaces
builder.Services.AddScoped<VulnerabilityScanJob>();
builder.Services.AddScoped<CveLocalRefreshJob>();   // ← fixes TypeLoadException

builder.Services.AddSignalR();
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS ─────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

// ── DB init ───────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<SystemMonitorContext>();
    context.Database.EnsureCreated();
}

// ── Middleware ────────────────────────────────────────────────
app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthorization();
app.UseSwagger();
app.UseSwaggerUI();

app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new HangfireAllowAllFilter() }
});

app.MapControllers();
app.MapHub<DeviceHub>("/deviceHub");

// ── Schedule daily scan at 1:00 AM ───────────────────────────
app.Lifetime.ApplicationStarted.Register(() =>
{
    using var scope = app.Services.CreateScope();
    var recurringJobManager = scope.ServiceProvider
        .GetRequiredService<IRecurringJobManager>();

    recurringJobManager.AddOrUpdate<VulnerabilityScanJob>(
        "daily-vulnerability-scan",
        job => job.RunAsync(),
        "0 1 * * *",
        new RecurringJobOptions
        {
            TimeZone = TimeZoneInfo.Local
        });
});


app.Run();