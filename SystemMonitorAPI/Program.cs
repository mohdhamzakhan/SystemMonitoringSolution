using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;
using SystemMonitorAPI.Model;


var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();

builder.Services.AddDbContext<SystemMonitorContext>(options => options.UseOracle(builder.Configuration.GetConnectionString("DefaultConnection"),
    options => options.UseOracleSQLCompatibility(OracleSQLCompatibility.DatabaseVersion19))
    .UseLazyLoadingProxies());

//builder.Services.AddDbContext<SystemMonitorContext>(options =>
//    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")).UseLazyLoadingProxies());
builder.Services.AddScoped<IDeviceService, DeviceService>();
// Add other services
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSignalR();
builder.Services.AddSwaggerGen();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.Preserve;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
//builder.Services.AddSwaggerGen();
builder.Services.AddSingleton<CredentialService>();
var app = builder.Build();

// Configure the HTTP request pipeline.
using(var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var context = services.GetRequiredService<SystemMonitorContext>();

    context.Database.EnsureCreated();

    var credentialService = services.GetRequiredService<CredentialService>();
}


app.UseAuthorization();
app.UseCors("AllowAll");
app.MapControllers();
app.UseSwagger();
app.UseSwaggerUI();
app.MapHub<DeviceHub>("/deviceHub");

app.Run();