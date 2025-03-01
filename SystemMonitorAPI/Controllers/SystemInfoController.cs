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
     [FromQuery] string? osVersion,
     [FromQuery] string? osName,
     [FromQuery] string? hostname,
     [FromQuery] string? make,
     [FromQuery] string? domain,
     [FromQuery] string? isEncrypted,
     [FromQuery] string? productState)
        {
            var query = _context.SystemDetails
                .Join(_context.antivirusInfos, r => r.Hostname, u => u.Hostname, (r, u) => new { r, u })
                .Join(_context.DiskDetails, d => d.r.Hostname, disk => disk.Hostname, (d, disk) => new { d, disk })
                .Where(x => x.disk.TypeOfDrive.Equals("Fixed") && x.d.u.DisplayName.Equals("Windows Defender"))
                .GroupBy(s => new
                {
                    s.d.r.Hostname,
                    s.d.r.Username,
                    s.d.r.OSVersion,
                    s.d.r.Make,
                    s.d.r.Domain,
                    s.d.u.ProductState,
                    s.d.u.DisplayName,
                    s.d.r.OSName
                })
                .Select(g => new
                {
                    g.Key.Hostname,
                    g.Key.Username,
                    g.Key.OSVersion,
                    g.Key.Make,
                    g.Key.Domain,
                    g.Key.ProductState,
                    g.Key.DisplayName,
                    g.Key.OSName,
                    // 🔍 Encryption logic: All, Some, or None
                    EncryptionStatus = g.All(d => d.disk.isEncrypted == 1) ? "Encrypted" :
                                       g.Any(d => d.disk.isEncrypted == 1) ? "Partially Encrypted" :
                                       "Not Encrypted"
                });

            // Apply filters dynamically
            if (!string.IsNullOrEmpty(osVersion))
                query = query.Where(s => s.OSVersion == osVersion);

            if (!string.IsNullOrEmpty(hostname))
                query = query.Where(s => s.Hostname.Contains(hostname));

            if (!string.IsNullOrEmpty(make))
                query = query.Where(s => s.Make == make);

            if (!string.IsNullOrEmpty(domain))
                query = query.Where(s => s.Domain == domain);

            if (!string.IsNullOrEmpty(isEncrypted))
                query = query.Where(s => s.EncryptionStatus == isEncrypted);

            if (!string.IsNullOrEmpty(productState))
                query = query.Where(s => s.ProductState == productState);


            if (!string.IsNullOrEmpty(osName))
                query = query.Where(s => s.OSName.Contains(osName));

            return Ok(await query.ToListAsync());
        }



    }
}
