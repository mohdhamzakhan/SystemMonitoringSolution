using Quartz;
using SystemMonitorAPI.Services;

namespace SystemMonitorAPI.Jobs
{
    /// <summary>
    /// Quartz.NET job that auto-scans on a configurable schedule.
    /// Add to DI via Program.cs — see example below.
    ///
    /// NuGet: Quartz.Extensions.Hosting
    /// </summary>
    [DisallowConcurrentExecution]
    public class NetworkScanJob : IJob
    {
        private readonly INetworkScanService _scanner;
        private readonly ILogger<NetworkScanJob> _logger;

        public NetworkScanJob(INetworkScanService scanner, ILogger<NetworkScanJob> logger)
        {
            _scanner = scanner;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            _logger.LogInformation("NetworkScanJob started at {Time}", DateTimeOffset.Now);
            try
            {
                var result = await _scanner.ScanAllPoolsAsync(context.CancellationToken);
                _logger.LogInformation("NetworkScanJob finished — {Found} switches found", result.SwitchesFound);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "NetworkScanJob failed");
                throw new JobExecutionException(ex, refireImmediately: false);
            }
        }
    }
}