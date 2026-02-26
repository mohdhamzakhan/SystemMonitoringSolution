using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using SystemMonitorAPI.Model;

var builder = WebApplication.CreateBuilder(args);

// Controllers
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.Preserve;
    });

// DB
builder.Services.AddDbContext<SystemMonitorContext>(options =>
    options.UseOracle(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        o => o.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19))
    .UseLazyLoadingProxies());

// Services
builder.Services.AddScoped<IDeviceService, DeviceService>();
builder.Services.AddSingleton<CredentialService>();

builder.Services.AddSignalR();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ✅ CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:3000",
                "https://localhost:7055",
                "http://10.235.20.49:5296",
                "http://10.235.20.49:5294", 
                "https://10.235.20.49:9010",
                "http://10.235.20.49:9011"
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

// DB init
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<SystemMonitorContext>();
    context.Database.EnsureCreated();
}

// 🔥 ORDER MATTERS
app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthorization();

app.UseSwagger();
app.UseSwaggerUI();

app.MapControllers();
app.MapHub<DeviceHub>("/deviceHub");

app.Run();
