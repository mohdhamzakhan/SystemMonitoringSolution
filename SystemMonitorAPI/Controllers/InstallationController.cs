using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using SystemMonitorAPI.Model;
using static Microsoft.EntityFrameworkCore.DbLoggerCategory;

namespace SystemMonitorAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class InstallationController : ControllerBase
    {
        private readonly SystemMonitorContext _context;
        private readonly CredentialService _credentialService;

        private const string EncryptionKey = "MEAI.123456789012"; // Replace with a securely stored key (16 bytes)

        public InstallationController(SystemMonitorContext context, CredentialService credentialService)
        {
            _context = context;
            _credentialService = credentialService;
        }


        #region Working
        /// <summary>
        /// Retrieves updates required for a specific hostname.
        /// </summary>
        [HttpGet("updates/{hostname}")]
        public async Task<IActionResult> GetUpdatesForHostname(string hostname)
        {
            if (string.IsNullOrWhiteSpace(hostname))
                return BadRequest("Hostname is required.");

            // Auto-skip any Failed update for this host that has exhausted its retry budget so it
            // stops permanently blocking lower-priority (higher Priority number) updates behind it.
            var exhausted = await _context.SystemUpdates
                .Include(su => su.UpdateInfo)
                .Where(su => su.SystemInfo.Hostname == hostname
                             && su.Status == "Failed"
                             && su.RetryCount >= su.UpdateInfo.MaxRetries)
                .ToListAsync();

            foreach (var su in exhausted)
            {
                su.Status = "Skipped";
                su.StatusMessage = $"Skipped after {su.RetryCount} failed attempt(s); allowing lower-priority updates to proceed.";
            }
            if (exhausted.Any())
                await _context.SaveChangesAsync();

            // Fetch pending/failed(-not-yet-exhausted) updates for the specified hostname,
            // lowest Priority number first so updates run strictly 1, 2, 3... in order.
            var updates = await _context.SystemUpdates
                .Where(su => su.SystemInfo.Hostname == hostname && (su.Status == "Pending" || su.Status == "Failed"))
                .OrderBy(su => su.UpdateInfo.Priority)
                .ThenBy(su => su.UpdateInfo.CreatedDate)
                .Select(su => new
                {
                    su.UpdateInfo.UpdateID,
                    su.UpdateInfo.FilePath,
                    su.UpdateInfo.Parameters,
                    su.UpdateInfo.FileName,
                    su.UpdateInfo.UpdateType,
                    su.UpdateInfo.Priority,
                    su.SystemID
                })
                .ToListAsync();

            if (updates == null || !updates.Any())
                return Ok("No updates required for the specified hostname.");

            // Fetch the global credentials
            var credential = await _context.Credentials
                .FirstOrDefaultAsync(); // Assuming there's only one entry for credentials

            if (credential == null)
                return NotFound("Global credentials not found.");

            // Include credentials in the result. Only the first (lowest-priority-number) entry
            // will actually be executed by the agent this cycle - see Worker.cs.
            var result = updates.Select(update => new
            {
                update.UpdateID,
                update.FilePath,
                update.Parameters,
                encryptedPassword = credential.EncryptedPassword,
                Username = credential.Username,
                update.FileName,
                update.UpdateType,
                update.Priority,
                update.SystemID
            });

            return Ok(result);
        }


        [HttpPost("assign-update")]
        public async Task<IActionResult> AssignUpdate([FromBody] AssignUpdateRequest request)
        {
            if (request.SystemIDs == null || request.SystemIDs.Count == 0)
            {
                return BadRequest("No hostnames selected.");
            }

            foreach (var systemId in request.SystemIDs)
            {
                var systemInfo = await _context.Systems.FindAsync(systemId);
                if (systemInfo == null)
                {
                    return NotFound($"System with ID {systemId} not found.");
                }

                // Create SystemUpdate entry for each selected system
                var systemUpdate = new SystemUpdate
                {
                    SystemID = systemId,
                    UpdateID = request.UpdateID,
                    Status = request.Status,
                    StatusMessage = request.StatusMessage,
                    LastAttemptDate = DateTime.Now
                };

                _context.SystemUpdates.Add(systemUpdate);
            }

            await _context.SaveChangesAsync();

            return Ok("Updates successfully assigned.");
        }


        [HttpGet("update-password")]
        public async Task<IActionResult> UpdatePassword(string password)
        {
            var encryptedPassword = _credentialService.Encrypt(password, true);

            var credential = new Credential
            {
                Hostname = "IT-L2-SP",
                Username = @"meai001n\bkpadmin",
                EncryptedPassword = encryptedPassword
            };

            var usernameAvailabe = await _context.Credentials
                .Where(z => z.Username == @"meai001n\bkpadmin").FirstOrDefaultAsync();

            if (usernameAvailabe != null)
            {
                usernameAvailabe.Hostname = "IT";
                usernameAvailabe.EncryptedPassword = encryptedPassword;
            }
            else
            {
                _context.Credentials.Add(credential);
            }
            _context.SaveChanges();

            return Ok();
        }

        [HttpGet("assigned-hostnames")]
        public async Task<IActionResult> GetAssignedHostnames([FromQuery] int updateID)
        {
            try
            {
                // Fetch the assigned systems with their details
                var assignedHostnames = await _context.SystemUpdates
                    .Join(_context.Devices, u => u.SystemInfo.Hostname, p => p.Hostname, (u, p) => new { u, p })
                    .Where(su => su.u.UpdateID == updateID)
                    .Select(su => new
                    {
                        su.u.SystemID,
                        su.u.SystemInfo.Hostname, // Assuming there's a navigation property for SystemInfo
                        su.u.Status,
                        su.u.StatusMessage,
                        su.u.LastAttemptDate,
                        su.p.Username
                    })
                    .ToListAsync();

                // Check if no data was found
                if (!assignedHostnames.Any())
                {
                    return NotFound(new { message = "No systems assigned to the specified update." });
                }

                return Ok(new { values = assignedHostnames });
            }
            catch (Exception ex)
            {
                // Log the error with detailed context
                return StatusCode(500, new { message = "An error occurred while fetching assigned hostnames." });
            }
        }

        [HttpGet("active-hosts")]
        public async Task<IActionResult> GetActiveHosts()
        {
            var activeHosts = await _context.Systems
                .Join(_context.SystemDetails, u => u.Hostname, s => s.Hostname, (u, s) => new { u, s })
                .Where(s => s.u.IsActive)
                .Select(s => new
                {
                    s.u.SystemID,
                    s.u.Hostname,
                    s.s.Username,
                    s.u.LastUpdateDate
                })
                .ToListAsync();

            return Ok(activeHosts);
        }

        [HttpGet("active-updates")]
        public async Task<IActionResult> GetActiveUpdates()
        {
            var activeUpdates = await _context.Updates
                .Select(u => new
                {
                    u.UpdateID,
                    u.FilePath,
                    u.FileName,
                    u.Parameters,
                    u.CreatedDate,
                    u.UpdateName,
                    u.IsLocal,
                    u.IsActive
                })
                .ToListAsync();

            return Ok(activeUpdates);
        }


        /// <summary>
        /// Updates the installation status of a specific update for a system.
        /// </summary>
        [HttpPost("update-status")]
        public async Task<IActionResult> UpdateInstallationStatus([FromBody] UpdateStatusRequest request)
        {
            try
            {
                if (request == null)
                {
                    return BadRequest("Request data is missing.");
                }

                // Ensure that the system exists in the Systems table (or SystemInfo if that is the actual name of your DbSet)
                var systemInfo = await _context.Systems // Use _context.SystemInfo if that's the actual table name.
                    .FirstOrDefaultAsync(si => si.SystemID == request.SystemID);

                if (systemInfo == null)
                {
                    return NotFound($"System with ID {request.SystemID} not found.");
                }

                // Check if the system update exists for the provided SystemID and UpdateID
                var systemUpdate = await _context.SystemUpdates
                    .FirstOrDefaultAsync(su => su.SystemID == request.SystemID && su.UpdateID == request.UpdateID);

                if (systemUpdate == null)
                {
                    return NotFound("System Update not found.");
                }

                // Update the status and status message of the existing system update
                systemUpdate.Status = request.Status;
                systemUpdate.StatusMessage = request.StatusMessage;
                systemUpdate.LastAttemptDate = DateTime.Now;
                if (string.Equals(request.Status, "Failed", StringComparison.OrdinalIgnoreCase))
                {
                    systemUpdate.RetryCount += 1;
                }

                // Create a new update log entry
                var updateLog = new UpdateLog
                {
                    SystemID = request.SystemID,
                    UpdateID = request.UpdateID,
                    LogMessage = $"{request.Status} - {request.StatusMessage}",
                    LogDate = DateTime.Now // Use UTC time for consistent logging
                };

                // Add the new log to the context
                _context.UpdateLogs.Add(updateLog);

                // Save the changes to both the SystemUpdates and UpdateLogs tables
                await _context.SaveChangesAsync();

                return Ok("Update status updated successfully.");
            }
            catch (Exception ex)
            {
                // Log the exception for debugging (replace Console with a logger for production)
                //_logger.LogError(ex, "Error updating installation status.");
                return BadRequest("An error occurred while updating the installation status.");
            }
        }
        public class ReassignRequest
        {
            public string Hostname { get; set; }
            public int UpdateId { get; set; }
        }
        [HttpPost("reassign")]
        public async Task<IActionResult> ReassignTask([FromBody] ReassignRequest request)
        {

            var systemUpdate = await _context.SystemUpdates
                .FirstOrDefaultAsync(su => su.SystemInfo.Hostname == request.Hostname && su.UpdateID == request.UpdateId);

            if (systemUpdate == null)
                return NotFound("System update not found.");

            // Reset status to Pending so it can be reassigned
            systemUpdate.Status = "Pending";
            systemUpdate.StatusMessage = "Task reassigned";
            systemUpdate.LastAttemptDate = DateTime.Now;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Task reassigned successfully." });
        }

        /// <summary>
        /// Retrieves the decrypted password for a given hostname.
        /// </summary>
        [HttpGet("password")]
        public async Task<IActionResult> GetPassword(string hostname)
        {
            if (string.IsNullOrWhiteSpace(hostname))
                return BadRequest("Hostname is required.");

            var credential = await _context.Credentials
                .FirstOrDefaultAsync(c => c.Hostname == hostname);

            if (credential == null)
                return NotFound("Credentials not found for the provided hostname.");

            // Decrypt the password
            string decryptedPassword;
            try
            {
                decryptedPassword = _credentialService.Decrypt(credential.EncryptedPassword, true);
            }
            catch
            {
                return StatusCode(500, "Error decrypting the password.");
            }

            return Ok(new { credential.Username, Password = decryptedPassword });
        }
        [HttpPost("update-info")]
        public async Task<IActionResult> CreateUpdateInfo([FromBody] UpdateInfo updateInfo)
        {
            try
            {
                if (updateInfo == null)
                    return BadRequest("Invalid data.");

                updateInfo.SystemUpdates = null; // Prevent cycle
                _context.Updates.Add(updateInfo);
                await _context.SaveChangesAsync();

                return Ok(new
                {
                    updateInfo.UpdateID,
                    updateInfo.UpdateName,
                    updateInfo.FilePath,
                    updateInfo.FileName,
                    updateInfo.Parameters,
                    updateInfo.IsActive,
                    updateInfo.IsLocal,
                    updateInfo.CreatedDate
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
        [HttpDelete("update-delete/{id}")]
        public async Task<IActionResult> DeleteUpdateInfo(int id)
        {
            // Load the UpdateInfo with related SystemUpdates + Logs
            var update = await _context.Updates
                .Include(u => u.SystemUpdates)
                .FirstOrDefaultAsync(u => u.UpdateID == id);

            if (update == null)
                return NotFound(new { message = $"Update with ID {id} not found." });

            // Step 1: Delete related SystemUpdates (if any)
            if (update.SystemUpdates.Any())
            {
                _context.SystemUpdates.RemoveRange(update.SystemUpdates);
            }

            // Step 2: Delete related UpdateLogs (if any)
            var logs = await _context.UpdateLogs
                .Where(l => l.UpdateID == id)
                .ToListAsync();

            if (logs.Any())
            {
                _context.UpdateLogs.RemoveRange(logs);
            }

            // Step 3: Delete the UpdateInfo itself
            _context.Updates.Remove(update);

            // Save changes
            await _context.SaveChangesAsync();

            return Ok(new { message = "Update, related system updates, and logs deleted successfully." });
        }

        // PUT endpoint for full update (already mentioned before)
        [HttpPut("update-info/{id}")]
        public async Task<IActionResult> UpdateUpdateInfo(int id, [FromBody] UpdateInfo updateInfo)
        {
            try
            {
                var existing = await _context.Updates.FindAsync(id);
                if (existing == null)
                    return NotFound("Update not found.");

                existing.UpdateName = updateInfo.UpdateName;
                existing.FilePath = updateInfo.FilePath;
                existing.FileName = updateInfo.FileName;
                existing.Parameters = updateInfo.Parameters;
                existing.IsLocal = updateInfo.IsLocal;
                existing.IsActive = updateInfo.IsActive;

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    existing.UpdateID,
                    existing.UpdateName,
                    existing.FilePath,
                    existing.FileName,
                    existing.Parameters,
                    existing.IsActive,
                    existing.IsLocal,
                    existing.CreatedDate
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // PATCH endpoint for toggling active status
        [HttpPatch("update-info/{id}/toggle-active")]
        public async Task<IActionResult> ToggleUpdateActive(int id, [FromBody] ToggleActiveRequest request)
        {
            try
            {
                var update = await _context.Updates.FindAsync(id);
                if (update == null)
                    return NotFound("Update not found.");

                update.IsActive = request.IsActive;

                // Mark the entity as modified
                _context.Entry(update).State = EntityState.Modified;

                // Or use this approach
                _context.Updates.Update(update);

                await _context.SaveChangesAsync();

                return Ok(new
                {
                    update.UpdateID,
                    update.UpdateName,
                    update.FilePath,
                    update.FileName,
                    update.Parameters,
                    update.IsActive,
                    update.IsLocal,
                    update.CreatedDate
                });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // DTO for toggle request
        public class ToggleActiveRequest
        {
            public bool IsActive { get; set; }
        }
        #endregion

        #region uninstall
        [HttpPost("uninsatll")]
        public async Task<IActionResult> uninsatllApplication([FromBody] UninstallInfo uninstallInfo)
        {
            try
            {
                if (uninstallInfo == null)
                    return BadRequest("Invalid data");
                _context.uninstallInfos.Add(uninstallInfo);
                await _context.SaveChangesAsync();
                return Ok(uninstallInfo);
            }
            catch
            {
                return BadRequest();
            }
        }

        [HttpGet("uninstalltion/{hostname}")]
        public async Task<IActionResult> GetUninstallApplication(string hostname)
        {
            if (string.IsNullOrWhiteSpace(hostname))
                return BadRequest("Hostname is required.");

            var uninstallRequest = await _context.uninstallInfos
                .Join(_context.SoftwareDetails, u => u.applicationId, s => s.SoftwareDetailsID, (u, s) => new { u, s })
               .Where(su => su.u.hostname == hostname && su.u.Active == 1)
               // "Pending" indicates updates needed
               .Select(su => new
               {
                   su.u.uninstallId,
                   su.u.applicationId,
                   su.s.UninstallString,
                   su.s.SoftwareName
               })
               .ToListAsync();
            if (uninstallRequest == null || !uninstallRequest.Any())
                return Ok("No uninstallation required for the specified hostname.");

            var credential = await _context.Credentials
               .FirstOrDefaultAsync(); // Assuming there's only one entry for credentials

            if (credential == null)
                return NotFound("Global credentials not found.");

            var result = uninstallRequest.Select(update => new
            {
                update.uninstallId,
                update.applicationId,
                update.UninstallString,
                encryptedPassword = credential.EncryptedPassword,
                Username = credential.Username,
                update.SoftwareName
            });

            return Ok(result);
        }

        [HttpDelete("system-update/{systemID}/{updateID}")]
        public async Task<IActionResult> DeleteSystemUpdate(int systemID, int updateID)
        {
            try
            {
                var systemUpdate = await _context.SystemUpdates
                    .FirstOrDefaultAsync(su =>
                        su.SystemID == systemID &&
                        su.UpdateID == updateID);

                if (systemUpdate == null)
                    return NotFound(new { message = "System update not found for given parameters." });

                _context.SystemUpdates.Remove(systemUpdate);
                await _context.SaveChangesAsync();

                return Ok(new { message = "Task deleted successfully." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    message = $"An error occurred while deleting the task: {ex.Message}"
                });
            }
        }

        #endregion
    }
}