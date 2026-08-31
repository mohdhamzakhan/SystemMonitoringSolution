using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentClassificationController : ControllerBase
    {
        private readonly SystemMonitorContext _db;
        private readonly ILogger<DocumentClassificationController> _logger;

        public DocumentClassificationController(SystemMonitorContext db, ILogger<DocumentClassificationController> logger)
        {
            _db = db;
            _logger = logger;
        }

        // Called by the Office add-ins on: new document, opening an unclassified legacy
        // document, and confirming/changing the classification on close.
        [HttpPost("log")]
        public async Task<IActionResult> Log([FromBody] DocumentClassificationRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Classification))
                return BadRequest(new { Message = "Classification is required." });

            if (!string.IsNullOrEmpty(request.ClientEventId))
            {
                var alreadyLogged = await _db.DocumentClassifications
                    .AnyAsync(x => x.ClientEventId == request.ClientEventId);
                if (alreadyLogged)
                    return Ok(new { Message = "Already recorded." });
            }

            var entry = new DocumentClassificationLog
            {
                ClientEventId = string.IsNullOrEmpty(request.ClientEventId) ? Guid.NewGuid().ToString() : request.ClientEventId,
                Hostname = request.Hostname,
                Username = request.Username,
                Application = request.Application,
                DocumentName = request.DocumentName,
                DocumentPath = request.DocumentPath,
                DocumentGuid = request.DocumentGuid,
                ActionType = request.ActionType,
                PreviousClassification = request.PreviousClassification,
                Classification = request.Classification,
                EventTime = request.EventTime == default ? DateTime.Now : request.EventTime
            };

            try
            {
                _db.DocumentClassifications.Add(entry);
                await _db.SaveChangesAsync();
                return Ok(new { Message = "Logged", Id = entry.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to log document classification event for {Document}", request.DocumentName);
                return StatusCode(500, new { Message = ex.Message });
            }
        }

        // Most recent classification recorded for a given document GUID — lets the add-in
        // pre-select the current level instead of asking cold every time.
        [HttpGet("latest")]
        public async Task<IActionResult> GetLatest([FromQuery] string documentGuid)
        {
            if (string.IsNullOrWhiteSpace(documentGuid))
                return BadRequest(new { Message = "documentGuid is required." });

            var latest = await _db.DocumentClassifications
                .Where(x => x.DocumentGuid == documentGuid)
                .OrderByDescending(x => x.EventTime)
                .FirstOrDefaultAsync();

            return latest == null ? NotFound() : Ok(latest);
        }

        // Simple audit feed — a future frontend can page/filter this per device or user.
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] string? hostname, [FromQuery] int take = 200)
        {
            var query = _db.DocumentClassifications.AsQueryable();
            if (!string.IsNullOrWhiteSpace(hostname))
                query = query.Where(x => x.Hostname == hostname);

            var results = await query
                .OrderByDescending(x => x.EventTime)
                .Take(Math.Clamp(take, 1, 1000))
                .ToListAsync();

            return Ok(results);
        }
    }

    public class DocumentClassificationRequest
    {
        public string? ClientEventId { get; set; }
        public string Hostname { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Application { get; set; } = string.Empty;
        public string DocumentName { get; set; } = string.Empty;
        public string? DocumentPath { get; set; }
        public string? DocumentGuid { get; set; }
        public string ActionType { get; set; } = string.Empty;
        public string? PreviousClassification { get; set; }
        public string Classification { get; set; } = string.Empty;
        public DateTime EventTime { get; set; }
    }
}