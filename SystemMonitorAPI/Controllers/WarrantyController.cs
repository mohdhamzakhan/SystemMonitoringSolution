using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WarrantyController : ControllerBase
    {
        private readonly SystemMonitorContext _context;

        public WarrantyController(SystemMonitorContext context)
        {
            _context = context;
        }

        // GET: api/warranty/expiring
        [HttpGet("expiring")]
        public async Task<ActionResult<WarrantyExpiringResponse>> GetExpiringWarranties([FromQuery] int months = 2)
        {
            var currentDate = DateTime.Now;
            var targetDate = currentDate.AddMonths(months);

            var expiringWarranties = await _context.SystemDetails
                .Where(w => w.EndDate.HasValue &&
                           w.EndDate.Value >= currentDate &&
                           w.EndDate.Value <= targetDate)
                .OrderBy(w => w.EndDate)
                .ToListAsync();

            var response = new WarrantyExpiringResponse
            {
                TotalCount = expiringWarranties.Count,
                ExpiringWithinMonths = months,
                Systems = expiringWarranties.Select(w => new WarrantyInfoDto
                {
                    Hostname = w.Hostname,
                    SerialNumber = w.BIOSSerial,
                    WarrantyStartDate = w.StartDate,
                    WarrantyEndDate = w.EndDate,
                    Model = w.Model,
                    Make = w.Make,
                    DaysRemaining = w.EndDate.HasValue
                        ? (int)(w.EndDate.Value - currentDate).TotalDays
                        : 0
                }).ToList()
            };

            return Ok(response);
        }

        // GET: api/warranty/all
        [HttpGet("all")]
        public async Task<ActionResult<IEnumerable<WarrantyInfoDto>>> GetAllWarranties()
        {
            var currentDate = DateTime.Now;
            var warranties = await _context.SystemDetails
                .OrderBy(w => w.EndDate)
                .ToListAsync();

            var result = warranties.Select(w => new WarrantyInfoDto
            {
                Hostname = w.Hostname,
                SerialNumber = w.BIOSSerial,
                WarrantyStartDate = w.StartDate,
                WarrantyEndDate = w.EndDate,
                Model = w.Model,
                Make = w.Make,
                DaysRemaining = w.EndDate.HasValue
                    ? (int)(w.EndDate.Value - currentDate).TotalDays
                    : 0
            }).ToList();

            return Ok(result);
        }

        // GET: api/warranty/expired
        [HttpGet("expired")]
        public async Task<ActionResult<IEnumerable<WarrantyInfoDto>>> GetExpiredWarranties()
        {
            var currentDate = DateTime.Now;
            var expiredWarranties = await _context.SystemDetails
                .Where(w => w.EndDate.HasValue && w.EndDate.Value < currentDate)
                .OrderByDescending(w => w.EndDate)
                .ToListAsync();

            var result = expiredWarranties.Select(w => new WarrantyInfoDto
            {
                Hostname = w.Hostname,
                SerialNumber = w.BIOSSerial,
                WarrantyStartDate = w.StartDate,
                WarrantyEndDate = w.EndDate,
                Model = w.Model,
                Make = w.Make,
                DaysRemaining = w.EndDate.HasValue
                    ? (int)(w.EndDate.Value - currentDate).TotalDays
                    : 0
            }).ToList();

            return Ok(result);
        }

        // GET: api/warranty/statistics
        [HttpGet("statistics")]
        public async Task<ActionResult<WarrantyStatistics>> GetWarrantyStatistics()
        {
            var currentDate = DateTime.Now;
            var allWarranties = await _context.SystemDetails.ToListAsync();

            var statistics = new WarrantyStatistics
            {
                TotalSystems = allWarranties.Count,
                ActiveWarranties = allWarranties.Count(w => w.EndDate.HasValue && w.EndDate.Value >= currentDate),
                ExpiredWarranties = allWarranties.Count(w => w.EndDate.HasValue && w.EndDate.Value < currentDate),
                ExpiringIn30Days = allWarranties.Count(w => w.EndDate.HasValue &&
                    w.EndDate.Value >= currentDate &&
                    w.EndDate.Value <= currentDate.AddDays(30)),
                ExpiringIn60Days = allWarranties.Count(w => w.EndDate.HasValue &&
                    w.EndDate.Value > currentDate.AddDays(30) &&
                    w.EndDate.Value <= currentDate.AddDays(60)),
                NoWarrantyInfo = allWarranties.Count(w => !w.EndDate.HasValue)
            };

            return Ok(statistics);
        }

        // POST: api/warranty/add
        [HttpPost("add")]
        public async Task<ActionResult<WarrantyInfoDto>> AddWarranty([FromBody] WarrantyUpdateRequest request)
        {
            try
            {
                // Check if hostname already exists
                var existingSystem = await _context.SystemDetails
                    .FirstOrDefaultAsync(s => s.Hostname == request.Hostname);

                if (existingSystem != null)
                {
                    return BadRequest(new { message = "A system with this hostname already exists" });
                }

                var systemDetail = new SystemDetail
                {
                    Hostname = request.Hostname,
                    BIOSSerial = request.SerialNumber,
                    StartDate = request.WarrantyStartDate,
                    EndDate = request.WarrantyEndDate,
                    Model = request.Model,
                    Make = request.Make
                };

                _context.SystemDetails.Add(systemDetail);
                await _context.SaveChangesAsync();

                var result = new WarrantyInfoDto
                {
                    Hostname = systemDetail.Hostname,
                    SerialNumber = systemDetail.BIOSSerial,
                    WarrantyStartDate = systemDetail.StartDate,
                    WarrantyEndDate = systemDetail.EndDate,
                    Model = systemDetail.Model,
                    Make = systemDetail.Make
                };

                return CreatedAtAction(nameof(GetWarrantyByHostname), new { hostname = systemDetail.Hostname }, result);
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to add warranty", error = ex.Message });
            }
        }

        // PUT: api/warranty/update/{hostname}
        [HttpPut("update/{hostname}")]
        public async Task<ActionResult> UpdateWarranty(string hostname, [FromBody] WarrantyUpdateRequest request)
        {
            try
            {
                var systemDetail = await _context.SystemDetails
                    .FirstOrDefaultAsync(s => s.Hostname == hostname);

                if (systemDetail == null)
                {
                    return NotFound(new { message = "System not found" });
                }

                // Update warranty fields
                systemDetail.BIOSSerial = request.SerialNumber ?? systemDetail.BIOSSerial;
                systemDetail.StartDate = request.WarrantyStartDate ?? systemDetail.StartDate;
                systemDetail.EndDate = request.WarrantyEndDate ?? systemDetail.EndDate;
                systemDetail.Model = request.Model ?? systemDetail.Model;
                systemDetail.Make = request.Make ?? systemDetail.Make;

                _context.SystemDetails.Update(systemDetail);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Warranty updated successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to update warranty", error = ex.Message });
            }
        }

        // DELETE: api/warranty/delete/{hostname}
        [HttpDelete("delete/{hostname}")]
        public async Task<ActionResult> DeleteWarranty(string hostname)
        {
            try
            {
                var systemDetail = await _context.SystemDetails
                    .FirstOrDefaultAsync(s => s.Hostname == hostname);

                if (systemDetail == null)
                {
                    return NotFound(new { message = "System not found" });
                }

                // Option 1: Delete the entire record
                // _context.SystemDetails.Remove(systemDetail);

                // Option 2: Just clear warranty dates (recommended to keep system info)
                systemDetail.StartDate = null;
                systemDetail.EndDate = null;
                _context.SystemDetails.Update(systemDetail);

                await _context.SaveChangesAsync();

                return Ok(new { message = "Warranty information deleted successfully" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Failed to delete warranty", error = ex.Message });
            }
        }

        // GET: api/warranty/{hostname}
        [HttpGet("{hostname}")]
        public async Task<ActionResult<WarrantyInfoDto>> GetWarrantyByHostname(string hostname)
        {
            var systemDetail = await _context.SystemDetails
                .FirstOrDefaultAsync(s => s.Hostname == hostname);

            if (systemDetail == null)
            {
                return NotFound(new { message = "System not found" });
            }

            var currentDate = DateTime.Now;
            var result = new WarrantyInfoDto
            {
                Hostname = systemDetail.Hostname,
                SerialNumber = systemDetail.BIOSSerial,
                WarrantyStartDate = systemDetail.StartDate,
                WarrantyEndDate = systemDetail.EndDate,
                Model = systemDetail.Model,
                Make = systemDetail.Make,
                DaysRemaining = systemDetail.EndDate.HasValue
                    ? (int)(systemDetail.EndDate.Value - currentDate).TotalDays
                    : 0
            };

            return Ok(result);
        }

        // GET: api/warranty/search/{searchTerm}
        [HttpGet("search/{searchTerm}")]
        public async Task<ActionResult<IEnumerable<WarrantyInfoDto>>> SearchWarranties(string searchTerm)
        {
            var currentDate = DateTime.Now;
            var systems = await _context.SystemDetails
                .Where(s => s.Hostname.Contains(searchTerm) ||
                           s.BIOSSerial.Contains(searchTerm) ||
                           s.Model.Contains(searchTerm))
                .OrderBy(s => s.Hostname)
                .ToListAsync();

            var result = systems.Select(w => new WarrantyInfoDto
            {
                Hostname = w.Hostname,
                SerialNumber = w.BIOSSerial,
                WarrantyStartDate = w.StartDate,
                WarrantyEndDate = w.EndDate,
                Model = w.Model,
                Make = w.Make,
                DaysRemaining = w.EndDate.HasValue
                    ? (int)(w.EndDate.Value - currentDate).TotalDays
                    : 0
            }).ToList();

            return Ok(result);
        }
    }

    // DTOs
    public class WarrantyInfoDto
    {
        public string Hostname { get; set; }
        public string SerialNumber { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string Model { get; set; }
        public string Make { get; set; }
        public int DaysRemaining { get; set; }
    }

    public class WarrantyExpiringResponse
    {
        public int TotalCount { get; set; }
        public int ExpiringWithinMonths { get; set; }
        public List<WarrantyInfoDto> Systems { get; set; }
    }

    public class WarrantyStatistics
    {
        public int TotalSystems { get; set; }
        public int ActiveWarranties { get; set; }
        public int ExpiredWarranties { get; set; }
        public int ExpiringIn30Days { get; set; }
        public int ExpiringIn60Days { get; set; }
        public int NoWarrantyInfo { get; set; }
    }

    public class WarrantyUpdateRequest
    {
        public string Hostname { get; set; }
        public string SerialNumber { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
        public string Model { get; set; }
        public string Make { get; set; }
    }
}