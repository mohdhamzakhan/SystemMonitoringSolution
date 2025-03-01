using Microsoft.EntityFrameworkCore;

namespace SystemMonitorAPI.Model
{
    public interface IDeviceService
    {
        Task UpdateLastHeartbeatAsync(string hostname, DateTime timestamp);
        Task CheckAndUpdateDeviceStatusesAsync();
    }

    public class DeviceService : IDeviceService
    {
        private readonly SystemMonitorContext _context;  // Assuming you use Entity Framework Core
        private readonly ILogger<DeviceService> _logger;

        public DeviceService(SystemMonitorContext context, ILogger<DeviceService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task UpdateLastHeartbeatAsync(string hostname, DateTime timestamp)
        {
            var device = await _context.Devices.Where(d => d.Hostname == hostname).FirstOrDefaultAsync();

            if (device != null)
            {
                device.LastUpdated = timestamp;
                device.Status = "Connected";  // Mark device as connected again
                await _context.SaveChangesAsync();
            }
            else
            {
                _logger.LogWarning($"Device with hostname {hostname} not found.");
            }
        }

        public async Task CheckAndUpdateDeviceStatusesAsync()
        {
            var threshold = DateTime.Now.AddMinutes(-10);
            var devicesToUpdate = await _context.Devices
                .Where(d => d.LastUpdated < threshold && d.Status == "Connected")
                .ToListAsync();

            foreach (var device in devicesToUpdate)
            {
                device.Status = "Disconnected";
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Device {device.Hostname} status updated to Disconnected.");
            }
        }
    }

}
