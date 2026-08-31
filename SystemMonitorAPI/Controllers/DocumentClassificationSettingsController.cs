using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/documentclassification/settings")]
    public class DocumentClassificationSettingsController : ControllerBase
    {
        private readonly SystemMonitorContext _db;
        private readonly ILogger<DocumentClassificationSettingsController> _logger;

        public DocumentClassificationSettingsController(SystemMonitorContext db, ILogger<DocumentClassificationSettingsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // Every watcher instance polls this on startup and periodically thereafter.
        // profile defaults to "Global" — pass a different name if you later split settings
        // per department/site.
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] string profile = "Global")
        {
            var settings = await _db.DocumentClassificationSettings
                .FirstOrDefaultAsync(x => x.ProfileName == profile);

            if (settings == null)
                return NotFound(new { Message = $"No settings row for profile '{profile}' yet." });

            return Ok(settings);
        }

        // Upserts the settings row. Call this from wherever you administer the tool
        // (Swagger/Postman for now, a proper admin page later).
        [HttpPut]
        public async Task<IActionResult> Update([FromBody] UpdateSettingsRequest request, [FromQuery] string profile = "Global")
        {
            if (string.IsNullOrWhiteSpace(request.ConfigJson))
                return BadRequest(new { Message = "ConfigJson is required." });

            var existing = await _db.DocumentClassificationSettings
                .FirstOrDefaultAsync(x => x.ProfileName == profile);

            if (existing == null)
            {
                existing = new DocumentClassificationSettings { ProfileName = profile };
                _db.DocumentClassificationSettings.Add(existing);
            }

            existing.ConfigJson = request.ConfigJson;
            existing.UpdatedAt = DateTime.Now;
            existing.UpdatedBy = request.UpdatedBy;

            await _db.SaveChangesAsync();
            return Ok(existing);
        }
    }

    public class UpdateSettingsRequest
    {
        public string ConfigJson { get; set; } = string.Empty;
        public string? UpdatedBy { get; set; }
    }
}