using SystemMonitorWorker;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHostedService<Worker>();

IHost host = Host.CreateDefaultBuilder(args)
    .ConfigureServices(services =>
    {
        services.AddHttpClient(); // Register HttpClient
        services.AddHostedService<SystemMonitorWorker.Worker>(); // Register Worker
    })
    .Build();

await host.RunAsync();
