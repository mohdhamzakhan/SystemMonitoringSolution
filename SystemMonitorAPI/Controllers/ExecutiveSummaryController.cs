// Place in SystemMonitorAPI/Controllers/. Exposes GET api/executive/overview (one row per device)
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/executive")]
    public class ExecutiveSummaryController : ControllerBase
    {
        private readonly SystemMonitorContext _db;
        public ExecutiveSummaryController(SystemMonitorContext db) => _db = db;

        [HttpGet("overview")]
        public async Task<IActionResult> Overview()
        {
            var devices = await _db.Devices.AsNoTracking().Include(d => d.antivirusInfos).ToListAsync();
            var details = (await _db.SystemDetails.AsNoTracking().ToListAsync())
                .Where(s => s.Hostname != null).GroupBy(s => s.Hostname!).ToDictionary(g => g.Key, g => g.First());
            var encrypted = (await _db.BitLockerKey.AsNoTracking().Where(k => !k.Archived)
                .Select(k => k.Hostname).Distinct().ToListAsync()).ToHashSet();

            var rows = devices.Select(d =>
            {
                details.TryGetValue(d.Hostname ?? "", out var sd);
                // EDR/AV state from Windows Security Center productState bit flags
                string edr = "none";
                var av = d.antivirusInfos?.FirstOrDefault(a =>
                    a.DisplayName != null && a.DisplayName.Contains("Defender", StringComparison.OrdinalIgnoreCase));
                if (av != null && long.TryParse(av.ProductState, out var st))
                {
                    if ((st & 0x1000) == 0) edr = "off";
                    else if (DateTimeOffset.TryParse(av.LastUpdate, CultureInfo.InvariantCulture,
                                 DateTimeStyles.AssumeUniversal, out var lastUpdate))
                        edr = lastUpdate < DateTimeOffset.UtcNow.AddDays(-3) ? "outdated" : "protected";
                    else
                        edr = (st & 0x10) != 0 ? "outdated" : "protected";
                }
                return new
                {
                    hostname = d.Hostname,
                    user = d.Username,
                    department = d.Department,
                    status = d.Status,
                    lastSeen = d.LastUpdated,
                    agent = d.AgentVersion,
                    os = sd?.OSName,
                    osVersion = sd?.OSVersion,
                    make = sd?.Make,
                    model = sd?.Model,
                    ram = sd?.PhysicalMemory,
                    domain = sd?.Domain,
                    startDate = sd?.StartDate,
                    endDate = sd?.EndDate,
                    edr,
                    bitlocker = encrypted.Contains(d.Hostname ?? "")
                };
            });
            return Ok(rows);
        }
    }
}