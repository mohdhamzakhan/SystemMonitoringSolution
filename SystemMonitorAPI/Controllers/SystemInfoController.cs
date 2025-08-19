using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SystemInfoController : ControllerBase
    {
        private readonly SystemMonitorContext _context;
        public SystemInfoController(SystemMonitorContext context)
        {
            _context = context;
        }
        [HttpGet("filter")]
        public async Task<ActionResult<IEnumerable<object>>> GetFilteredSystemInfo(
    [FromQuery] string? search
)
        {
            var diskInfoGrouped = _context.DiskInfo
                .Where(x=>x.InterfaceType != "USB")
    .GroupBy(x => x.Hostname)
    .Select(g => new { Hostname = g.Key, Capacities = string.Join(", ", g.Select(d => d.Capacity)) });

            var query = _context.SystemDetails
                .Join(_context.Devices, s => s.Hostname, d => d.Hostname, (s, d) => new { s, d })
                .Join(_context.antivirusInfos, r => r.d.Hostname, u => u.Hostname, (r, u) => new { r, u })
                .Join(_context.DiskDetails, d => d.r.d.Hostname, disk => disk.Hostname, (d, disk) => new { d, disk })
                .Join(diskInfoGrouped, u => u.d.r.d.Hostname, hdd => hdd.Hostname, (u, hdd) => new { u, hdd })
                .Where(x => x.u.disk.TypeOfDrive == "Fixed" && x.u.d.u.DisplayName == "Windows Defender")
                .AsEnumerable()
                .GroupBy(s => new
                {
                    s.u.d.r.d.Hostname,
                    s.u.d.r.d.Username,
                    s.u.d.r.s.OSVersion,
                    s.u.d.r.s.Make,
                    s.u.d.r.s.OSName,
                    s.u.d.r.s.ProcessorFamily,
                    s.u.d.r.s.BIOSSerial,
                    s.u.d.r.s.ProductId,
                    s.u.d.r.s.Model,
                    s.u.d.r.d.Department,
                    s.u.d.r.s.PhysicalMemory,
                    s.u.d.r.s.StartDate,
                    s.u.d.r.s.EndDate
                    
                })
                .Select(g => new
                {
                    g.Key.Hostname,
                    g.Key.Username,
                    g.Key.Department,
                    g.Key.Make,
                    g.Key.Model,
                    g.Key.BIOSSerial,
                    g.Key.ProductId,
                    g.Key.OSVersion,
                    g.Key.OSName,
                    g.Key.ProcessorFamily,
                    g.Key.PhysicalMemory,
                    g.Key.StartDate,
                    g.Key.EndDate,

                    // Use grouped disk info here (already deduplicated)
                    DiskInfo = g.First().hdd.Capacities,


                    EncryptionStatus = g.All(d => d.u.disk.isEncrypted == 1) ? "Encrypted" :
                                       g.Any(d => d.u.disk.isEncrypted == 1) ? "Partially Encrypted" :
                                       "Not Encrypted"
                })
                .ToList();

            // 🔍 Global search filter
            if (!string.IsNullOrEmpty(search))
            {
                search = search.ToLower();

                query = query.Where(s =>
                    (s.Hostname != null && s.Hostname.ToLower().Contains(search)) ||
                    (s.Username != null && s.Username.ToLower().Contains(search)) ||
                    (s.Department != null && s.Department.ToLower().Contains(search)) ||
                    (s.Make != null && s.Make.ToLower().Contains(search)) ||
                    (s.Model != null && s.Model.ToLower().Contains(search)) ||
                    (s.BIOSSerial != null && s.BIOSSerial.ToLower().Contains(search)) ||
                    (s.ProductId != null && s.ProductId.ToLower().Contains(search)) ||
                    (s.OSVersion != null && s.OSVersion.ToLower().Contains(search)) ||
                    (s.OSName != null && s.OSName.ToLower().Contains(search)) ||
                    (s.ProcessorFamily != null && s.ProcessorFamily.ToLower().Contains(search)) ||
                    s.PhysicalMemory.ToString().Contains(search) ||
                    (s.DiskInfo != null && s.DiskInfo.ToLower().Contains(search)) || // 🆕 include full disk info in search
                    (s.EncryptionStatus != null && s.EncryptionStatus.ToLower().Contains(search))
                ).ToList();
            }

            return Ok(query);
        }






    }
}
