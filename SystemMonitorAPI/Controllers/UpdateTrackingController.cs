using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{

    [Route("api/[controller]")]
    [ApiController]
    public class UpdateTrackingController : ControllerBase
    {
        private readonly SystemMonitorContext _context;

        public UpdateTrackingController(SystemMonitorContext context)
        {
            _context = context;
        }

        [HttpGet("updates-with-status")]
        public async Task<IActionResult> GetUpdatesWithStatus()
        {
            try
            {
                var updates = await _context.Updates
                    .Where(u => u.IsActive)
                    .Select(u => new
                    {
                        u.UpdateID,
                        u.UpdateName,
                        u.FileName,
                        u.CreatedDate,
                        SystemCount = u.SystemUpdates.Count(),
                        SuccessCount = u.SystemUpdates.Count(su => su.Status == "Success"),
                        PendingCount = u.SystemUpdates.Count(su => su.Status == "Pending"),
                        FailedCount = u.SystemUpdates.Count(su => su.Status == "Failed")
                    }).ToListAsync();

                return Ok(new { updates });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to fetch updates", details = ex.Message });
            }
        }

        [HttpGet("systems-by-update/{updateId}")]
        public async Task<IActionResult> GetSystemsByUpdate(int updateId)
        {
            try
            {
                var systemUpdates = await _context.SystemUpdates
                    .Where(su => su.UpdateID == updateId)
                    .Select(su => new
                    {
                        su.SystemInfo.SystemID,
                        su.SystemInfo.Hostname,
                        su.Status,
                        su.StatusMessage,
                        su.LastAttemptDate,
                        su.SystemInfo.LastUpdateDate
                    })
                    .ToListAsync();

                return Ok(new { systems = systemUpdates });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to fetch systems", details = ex.Message });
            }
        }

        [HttpGet("available-systems/{updateId}")]
        public async Task<IActionResult> GetAvailableSystemsForUpdate(int updateId)
        {
            try
            {
                // Get systems that either don't have this update or failed it
                var availableSystems = await _context.Systems
                    .Where(s => s.IsActive &&
                        (!s.SystemUpdates.Any(su => su.UpdateID == updateId) ||
                         s.SystemUpdates.Any(su => su.UpdateID == updateId &&
                            (su.Status == "Failed" || su.Status == "Pending"))))
                    .Select(s => new
                    {
                        s.SystemID,
                        s.Hostname,
                        s.LastUpdateDate,
                        CurrentStatus = s.SystemUpdates
                            .Where(su => su.UpdateID == updateId)
                            .Select(su => su.Status)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                return Ok(new { systems = availableSystems });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to fetch available systems", details = ex.Message });
            }
        }

        [HttpPost("bulk-assign")]
        public async Task<IActionResult> BulkAssignUpdate([FromBody] BulkAssignRequest request)
        {
            try
            {
                var systems = await _context.Systems
                    .Where(s => request.SystemIDs.Contains(s.SystemID))
                    .ToListAsync();

                foreach (var system in systems)
                {
                    // Check if update already exists for this system
                    var existingUpdate = await _context.SystemUpdates
                        .FirstOrDefaultAsync(su =>
                            su.SystemID == system.SystemID &&
                            su.UpdateID == request.UpdateID);

                    if (existingUpdate != null)
                    {
                        // Update existing record if not successful
                        if (existingUpdate.Status != "Success")
                        {
                            existingUpdate.Status = "Pending";
                            existingUpdate.StatusMessage = "Update reassigned";
                            existingUpdate.LastAttemptDate = DateTime.Now;
                        }
                    }
                    else
                    {
                        // Create new system update record
                        var systemUpdate = new SystemUpdate
                        {
                            SystemID = system.SystemID,
                            UpdateID = request.UpdateID,
                            Status = "Pending",
                            StatusMessage = "Update assigned",
                            LastAttemptDate = DateTime.Now
                        };
                        _context.SystemUpdates.Add(systemUpdate);
                    }
                }

                await _context.SaveChangesAsync();
                return Ok(new { message = "Updates assigned successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to assign updates", details = ex.Message });
            }
        }
    }

    public class BulkAssignRequest
    {
        public int UpdateID { get; set; }
        public List<int> SystemIDs { get; set; }
    }
}
