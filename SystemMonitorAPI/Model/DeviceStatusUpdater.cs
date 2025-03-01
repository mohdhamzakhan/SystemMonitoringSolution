using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace SystemMonitorAPI.Model
{
    public class DeviceStatusUpdater
    {
        private readonly SystemMonitorContext _context;
        private readonly IHubContext<DeviceHub> _hubContext;
        private readonly ILogger<DeviceStatusUpdater> _logger;
        public DeviceStatusUpdater(SystemMonitorContext context, IHubContext<DeviceHub> hubContext, ILogger<DeviceStatusUpdater> logger)
        {
            _context = context;
            _hubContext = hubContext;
            _logger = logger;
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

                // Notify connected clients about the status change
                await _hubContext.Clients.All.SendAsync("DeviceStatusUpdated", new
                {
                    device.Hostname,
                    device.Status,
                    device.LastUpdated
                });

                _logger.LogInformation($"Device {device.Hostname} status updated to Disconnected.");

            }
        }
    }
}
