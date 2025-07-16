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

        #region Useless
        //[ApiController]
        //[Route("api/[controller]")]
        //public class InstallationController : ControllerBase
        //{
        //    private readonly IUpdateService _updateService;
        //    private readonly ILogger<InstallationController> _logger;

        //    public InstallationController(IUpdateService updateService, ILogger<InstallationController> logger)
        //    {
        //        _updateService = updateService;
        //        _logger = logger;
        //    }

        //    [HttpPost("update-info")]
        //    public async Task<ActionResult<UpdateInfo>> SubmitUpdateInfo([FromBody] UpdateInfo updateInfo)
        //    {
        //        try
        //        {
        //            if (!ModelState.IsValid)
        //            {
        //                return BadRequest(ModelState);
        //            }

        //            var result = await _updateService.SubmitUpdateInfoAsync(updateInfo);
        //            return Ok(result);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in SubmitUpdateInfo");
        //            return StatusCode(500, new { message = "An error occurred while processing your request" });
        //        }
        //    }

        //    [HttpGet("active-hosts")]
        //    public async Task<ActionResult<List<SystemInfo>>> GetActiveHosts()
        //    {
        //        try
        //        {
        //            var hosts = await _updateService.GetActiveHostsAsync();
        //            return Ok(hosts);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in GetActiveHosts");
        //            return StatusCode(500, new { message = "An error occurred while retrieving active hosts" });
        //        }
        //    }

        //    [HttpPost("assign-update")]
        //    public async Task<IActionResult> AssignUpdate([FromBody] UpdateAssignmentRequest assignment)
        //    {
        //        try
        //        {
        //            if (!ModelState.IsValid)
        //            {
        //                return BadRequest(ModelState);
        //            }

        //            var result = await _updateService.AssignUpdateAsync(assignment);
        //            return Ok(new { message = "Update assigned successfully" });
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in AssignUpdate");
        //            return StatusCode(500, new { message = "An error occurred while assigning the update" });
        //        }
        //    }

        //    [HttpGet("active-updates")]
        //    public async Task<ActionResult<List<UpdateInfo>>> GetActiveUpdates()
        //    {
        //        try
        //        {
        //            var updates = await _updateService.GetActiveUpdatesAsync();
        //            return Ok(updates);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in GetActiveUpdates");
        //            return StatusCode(500, new { message = "An error occurred while retrieving active updates" });
        //        }
        //    }

        //    [HttpGet("assigned-systems")]
        //    public async Task<ActionResult<List<SystemUpdate>>> GetAssignedSystems([FromQuery] int updateId)
        //    {
        //        try
        //        {
        //            var systems = await _updateService.GetAssignedSystemsAsync(updateId);
        //            return Ok(systems);
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in GetAssignedSystems");
        //            return StatusCode(500, new { message = "An error occurred while retrieving assigned systems" });
        //        }
        //    }
        #endregion
        #region Working
        /// <summary>
        /// Retrieves updates required for a specific hostname.
        /// </summary>
        [HttpGet("updates/{hostname}")]
        public async Task<IActionResult> GetUpdatesForHostname(string hostname)
        {
            if (string.IsNullOrWhiteSpace(hostname))
                return BadRequest("Hostname is required.");

            // Fetch pending updates for the specified hostname
            var updates = await _context.SystemUpdates
                .Where(su => su.SystemInfo.Hostname == hostname && ((su.Status == "Pending") || (su.Status == "Failed"))) // "Pending" indicates updates needed
                .Select(su => new
                {
                    su.UpdateInfo.UpdateID,
                    su.UpdateInfo.FilePath,
                    su.UpdateInfo.Parameters,
                    su.UpdateInfo.FileName,
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

            // Include credentials in the result
            var result = updates.Select(update => new
            {
                update.UpdateID,
                update.FilePath,
                update.Parameters,
                encryptedPassword = credential.EncryptedPassword,
                Username = credential.Username,
                update.FileName,
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
                    LastAttemptDate = DateTime.UtcNow
                };

                _context.SystemUpdates.Add(systemUpdate);
            }

            await _context.SaveChangesAsync();

            return Ok("Updates successfully assigned.");
        }


        [HttpGet("update-password")]
        public async Task<IActionResult> UpdatePassword()
        {
            var encryptedPassword = _credentialService.Encrypt("KYA%^", true);

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
                    .Join(_context.Devices,u=>u.SystemInfo.Hostname,p=>p.Hostname, (u, p) => new { u, p })
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
                .Where(s => s.IsActive)
                .Select(s => new
                {
                    s.SystemID,
                    s.Hostname,
                    s.LastUpdateDate
                })
                .ToListAsync();

            return Ok(activeHosts);
        }

        [HttpGet("active-updates")]
        public async Task<IActionResult> GetActiveUpdates()
        {
            var activeUpdates = await _context.Updates
                .Where(u => u.IsActive)
                .Select(u => new
                {
                    u.UpdateID,
                    u.FilePath,
                    u.FileName,
                    u.Parameters,
                    u.CreatedDate,
                    u.UpdateName
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

                _context.Updates.Add(updateInfo);
                await _context.SaveChangesAsync();

                return Ok(updateInfo);
            }
            catch
            {

                return BadRequest();
            }
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
                .Join(_context.SoftwareDetails, u=>u.applicationId, s=>s.SoftwareDetailsID, (u,s) => new {u,s})
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
        #endregion
    }
}
