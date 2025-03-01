
using Microsoft.EntityFrameworkCore;

namespace SystemMonitorAPI.Model
{
    public class UpdateAssignmentRequest
    {
        public int UpdateID { get; set; }
        public List<int> SystemIDs { get; set; }
    }
    public class UpdateService : IUpdateService
    {
        private readonly SystemMonitorContext _context;
        private readonly ILogger<UpdateService> _logger;

        public UpdateService(SystemMonitorContext context, ILogger<UpdateService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<UpdateInfo> SubmitUpdateInfoAsync(UpdateInfo updateInfo)
        {
            try
            {
                _context.Updates.Add(updateInfo);
                await _context.SaveChangesAsync();
                return updateInfo;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting update info");
                throw;
            }
        }

        public async Task<List<SystemInfo>> GetActiveHostsAsync()
        {
            try
            {
                return await _context.Systems
                    .Where(s => s.IsActive)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active hosts");
                throw;
            }
        }

        public async Task<bool> AssignUpdateAsync(UpdateAssignmentRequest assignment)
        {
            try
            {
                var systemUpdates = assignment.SystemIDs.Select(systemId => new SystemUpdate
                {
                    SystemID = systemId,
                    UpdateID = assignment.UpdateID,
                    Status = "Pending",
                    LastAttemptDate = DateTime.UtcNow
                }).ToList();

                await _context.SystemUpdates.AddRangeAsync(systemUpdates);

                // Create log entries for the assignments
                var logEntries = assignment.SystemIDs.Select(systemId => new UpdateLog
                {
                    SystemID = systemId,
                    UpdateID = assignment.UpdateID,
                    LogMessage = "Update assigned",
                    LogDate = DateTime.UtcNow
                }).ToList();

                await _context.UpdateLogs.AddRangeAsync(logEntries);

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error assigning update");
                throw;
            }
        }

        public async Task<List<UpdateInfo>> GetActiveUpdatesAsync()
        {
            try
            {
                return await _context.Updates
                    .Where(u => u.IsActive)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting active updates");
                throw;
            }
        }

        public async Task<List<SystemUpdate>> GetAssignedSystemsAsync(int updateId)
        {
            try
            {
                return await _context.SystemUpdates
                    .Include(su => su.SystemInfo)
                    .Where(su => su.UpdateID == updateId)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting assigned systems");
                throw;
            }
        }
    }
}
