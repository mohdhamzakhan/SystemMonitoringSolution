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

        // Filterable, paginated audit feed backing the frontend dashboard.
        [HttpGet("history")]
        public async Task<IActionResult> GetHistory(
            [FromQuery] string? username,
            [FromQuery] string? hostname,
            [FromQuery] string? application,
            [FromQuery] string? classification,
            [FromQuery] string? actionType,
            [FromQuery] string? documentName,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            var query = _db.DocumentClassifications.AsQueryable();

            if (!string.IsNullOrWhiteSpace(username))
                query = query.Where(x => x.Username.Contains(username));
            if (!string.IsNullOrWhiteSpace(hostname))
                query = query.Where(x => x.Hostname.Contains(hostname));
            if (!string.IsNullOrWhiteSpace(application))
                query = query.Where(x => x.Application == application);
            if (!string.IsNullOrWhiteSpace(classification))
                query = query.Where(x => x.Classification == classification);
            if (!string.IsNullOrWhiteSpace(actionType))
                query = query.Where(x => x.ActionType == actionType);
            if (!string.IsNullOrWhiteSpace(documentName))
                query = query.Where(x => x.DocumentName.Contains(documentName));
            if (fromDate.HasValue)
                query = query.Where(x => x.EventTime >= fromDate.Value);
            if (toDate.HasValue)
                query = query.Where(x => x.EventTime <= toDate.Value);

            var totalCount = await query.CountAsync();

            pageSize = Math.Clamp(pageSize, 1, 500);
            page = Math.Max(page, 1);

            var results = await query
                .OrderByDescending(x => x.EventTime)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Ok(new
            {
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
                Results = results
            });
        }

        // Populates the Application/Classification/ActionType filter dropdowns from
        // whatever values actually exist, instead of hardcoding them client-side.
        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions()
        {
            var applications = await _db.DocumentClassifications.Select(x => x.Application).Distinct().ToListAsync();
            var classifications = await _db.DocumentClassifications.Select(x => x.Classification).Distinct().ToListAsync();
            var actionTypes = await _db.DocumentClassifications.Select(x => x.ActionType).Distinct().ToListAsync();

            return Ok(new { Applications = applications, Classifications = classifications, ActionTypes = actionTypes });
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