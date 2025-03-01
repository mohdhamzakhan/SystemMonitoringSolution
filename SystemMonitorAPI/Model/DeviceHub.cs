using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace SystemMonitorAPI.Model
{
    public class DeviceHub: Hub
    {
        private readonly SystemMonitorContext _context;

        public DeviceHub(SystemMonitorContext context)
        {
            _context = context;
        }

        public async Task DeviceStatusUpdated()
        {
            // Implement logic to check and broadcast device statuses
            var devices = await _context.Devices.ToListAsync();
            await Clients.All.SendAsync("DeviceStatusUpdated", devices);
        }
    }
}
