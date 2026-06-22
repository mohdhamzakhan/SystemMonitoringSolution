using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FolderTreeController : ControllerBase
    {
        private readonly SystemMonitorContext _context;

        public FolderTreeController(SystemMonitorContext context)
        {
            _context = context;
        }

        // GET api/FolderTree/roots
        [HttpGet("roots")]
        public async Task<IActionResult> GetRoots()
        {
            var diskNames = await _context.DiskDetails
                .Where(d => d.TypeOfDrive == "Network" && d.DiskName != null)
                .Select(d => d.DiskName!)
                .ToListAsync();

            var uncPaths = diskNames
                .Select(ExtractUncPath)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            // Build full tree from all UNC paths
            var root = BuildTreeFromPaths(uncPaths);

            // Return children of the virtual root (the actual server nodes)
            return Ok(root.Children);
        }

        // GET api/FolderTree/children?path=\\meaisdfs\SANAND_IT
        [HttpGet("children")]
        public async Task<IActionResult> GetChildren([FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("path is required");

            var diskNames = await _context.DiskDetails
                .Where(d => d.TypeOfDrive == "Network" && d.DiskName != null)
                .Select(d => d.DiskName!)
                .ToListAsync();

            var uncPaths = diskNames
                .Select(ExtractUncPath)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var normalizedTarget = NormalizePath(path);

            // Find all UNC paths that start with the requested path
            var childPaths = uncPaths
                .Where(p => NormalizePath(p).StartsWith(normalizedTarget + @"\"))
                .ToList();

            // Extract the immediate next segment after the target path
            var children = childPaths
                .Select(p =>
                {
                    var rest = NormalizePath(p).Substring(normalizedTarget.Length).TrimStart('\\');
                    var segment = rest.Split('\\')[0];
                    var fullChildPath = path.TrimEnd('\\') + @"\" + segment;
                    return new { segment, fullChildPath };
                })
                .GroupBy(x => x.segment, StringComparer.OrdinalIgnoreCase)
                .Select(g =>
                {
                    var childFullPath = g.First().fullChildPath;
                    var normalizedChild = NormalizePath(childFullPath);
                    var hasChildren = uncPaths.Any(p =>
                        NormalizePath(p).StartsWith(normalizedChild + @"\"));
                    return new FolderNode
                    {
                        Name = g.Key,
                        FullPath = childFullPath,
                        HasChildren = hasChildren
                    };
                })
                .OrderBy(n => n.Name)
                .ToList();

            return Ok(children);
        }

        // GET api/FolderTree/hosts?path=\\meaisdfs\SANAND_IT\general
        [HttpGet("hosts")]
        public async Task<IActionResult> GetHostsForFolder([FromQuery] string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return BadRequest("path is required");

            var allDisks = await _context.DiskDetails
                .Where(d => d.TypeOfDrive == "Network" && d.DiskName != null)
                .ToListAsync();

            var normalizedTarget = NormalizePath(path);

            var matches = allDisks
                .Select(d => new
                {
                    d.Hostname,
                    d.DiskName,
                    d.Capacity,
                    d.FreeSpace,
                    Unc = ExtractUncPath(d.DiskName!)
                })
                .Where(d => !string.IsNullOrWhiteSpace(d.Unc))
                .Select(d => new { d, NormUnc = NormalizePath(d.Unc!) })
                .Where(x =>
                    // EXACT match: this folder is directly mapped
                    x.NormUnc == normalizedTarget
                    ||
                    // CHILD match: a subfolder under this folder is mapped
                    x.NormUnc.StartsWith(normalizedTarget + @"\"))
                .Select(x => x.d)
                .ToList();

            var hostnames = matches
                .Select(m => m.Hostname)
                .Distinct()
                .ToList();

            var devices = await _context.Devices
                .Where(dev => hostnames.Contains(dev.Hostname))
                .Select(dev => new
                {
                    dev.Hostname,
                    dev.Username,
                    dev.Department,
                    dev.Status
                })
                .ToListAsync();

            var combined = matches
                .GroupBy(m => new { m.Hostname, m.DiskName })
                .Select(g =>
                {
                    var first = g.First();
                    var device = devices.FirstOrDefault(d => d.Hostname == first.Hostname);
                    return new
                    {
                        Hostname = first.Hostname,
                        DiskName = first.Unc,        // stripped UNC, not raw DiskName
                        MappedPath = first.Unc,      // same — already has last segment removed
                        Capacity = first.Capacity,
                        FreeSpace = first.FreeSpace,
                        Username = device?.Username,
                        Department = device?.Department,
                        Status = device?.Status
                    };
                })
                .OrderBy(x => x.Hostname)
                .ToList();

            return Ok(combined);
        }

        // GET api/FolderTree/search?term=xyz
        [HttpGet("search")]
        public async Task<IActionResult> Search([FromQuery] string term)
        {
            if (string.IsNullOrWhiteSpace(term))
                return BadRequest("term is required");

            term = term.Trim().ToLowerInvariant();

            var allDisks = await _context.DiskDetails
                .Where(d => d.TypeOfDrive == "Network" && d.DiskName != null)
                .ToListAsync();

            var allDevices = await _context.Devices.ToListAsync();

            // Extract and normalize UNC from every disk record
            var diskRecords = allDisks
                .Select(d => new
                {
                    d.Hostname,
                    d.DiskName,
                    d.Capacity,
                    d.FreeSpace,
                    Unc = ExtractUncPath(d.DiskName!)
                })
                .Where(d => !string.IsNullOrWhiteSpace(d.Unc))
                .ToList();

            // Match by hostname OR extracted UNC path (folder search)
            var byPathOrHost = diskRecords
                .Where(d =>
                    (d.Hostname != null && d.Hostname.ToLowerInvariant().Contains(term)) ||
                    (d.Unc != null && d.Unc.ToLowerInvariant().Contains(term)))
                .Select(d => new
                {
                    d.Hostname,
                    DiskName = d.Unc,   // return clean UNC not raw
                    d.Capacity,
                    d.FreeSpace,
                    Username = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Username,
                    Department = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Department,
                    Status = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Status
                })
                .ToList();

            // Match by username or department
            var byUser = allDevices
                .Where(d =>
                    (d.Username != null && d.Username.ToLowerInvariant().Contains(term)) ||
                    (d.Department != null && d.Department.ToLowerInvariant().Contains(term)) ||
                    (d.Hostname != null && d.Hostname.ToLowerInvariant().Contains(term)))
                .ToList();

            var byUserHostnames = byUser.Select(d => d.Hostname).Distinct().ToList();

            // Get all mapped folders for users matched by username/department
            var relatedFolders = diskRecords
                .Where(d => byUserHostnames.Contains(d.Hostname))
                .Select(d => new
                {
                    d.Hostname,
                    DiskName = d.Unc,   // clean UNC
                    d.Capacity,
                    d.FreeSpace,
                    Username = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Username,
                    Department = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Department,
                    Status = allDevices.FirstOrDefault(dev => dev.Hostname == d.Hostname)?.Status
                })
                .ToList();

            return Ok(new
            {
                byPathOrHost,
                byUser = byUser.Select(d => new
                {
                    d.Hostname,
                    d.Username,
                    d.Department,
                    d.Status
                }),
                relatedFolders
            });
        }

        // GET api/FolderTree/debug-paths
        [HttpGet("debug-paths")]
        public async Task<IActionResult> DebugPaths()
        {
            var diskNames = await _context.DiskDetails
                .Where(d => d.TypeOfDrive == "Network" && d.DiskName != null)
                .Select(d => new { d.Hostname, d.DiskName })
                .ToListAsync();

            var debug = diskNames.Select(d => new
            {
                d.Hostname,
                Raw = d.DiskName,
                Extracted = ExtractUncPath(d.DiskName!),
                Normalized = ExtractUncPath(d.DiskName!) != null
                    ? NormalizePath(ExtractUncPath(d.DiskName!)!)
                    : null
            }).ToList();

            return Ok(debug);
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        // Builds a virtual root node whose children are the server nodes
        private FolderNode BuildTreeFromPaths(List<string> uncPaths)
        {
            var virtualRoot = new FolderNode { Name = "", FullPath = "" };

            foreach (var unc in uncPaths)
            {
                // e.g. \\meaisdfs\SANAND_IT\general\SANAND_IT
                // segments after splitting on \ with no empty entries:
                // meaisdfs, SANAND_IT, general, SANAND_IT
                var parts = unc.TrimStart('\\').Split('\\', StringSplitOptions.RemoveEmptyEntries);

                var current = virtualRoot;
                var pathSoFar = @"\\";

                foreach (var part in parts)
                {
                    pathSoFar = pathSoFar == @"\\" ? $@"\\{part}" : $@"{pathSoFar}\{part}";

                    var existing = current.Children
                        .FirstOrDefault(c => c.Name.Equals(part, StringComparison.OrdinalIgnoreCase));

                    if (existing == null)
                    {
                        var node = new FolderNode
                        {
                            Name = part,
                            FullPath = pathSoFar,
                            HasChildren = false
                        };
                        current.Children.Add(node);
                        current = node;
                    }
                    else
                    {
                        current = existing;
                    }
                }
            }

            // Set HasChildren based on actual children list
            SetHasChildren(virtualRoot);

            return virtualRoot;
        }

        private void SetHasChildren(FolderNode node)
        {
            node.HasChildren = node.Children.Count > 0;
            foreach (var child in node.Children)
                SetHasChildren(child);
        }

        private string? ExtractUncPath(string diskName)
        {
            if (string.IsNullOrWhiteSpace(diskName))
                return null;

            var s = diskName.Trim().Trim('"');
            var start = s.IndexOf(@"\\");
            if (start < 0) return null;

            var end = s.LastIndexOf(')');
            if (end < 0 || end <= start) return null;

            var unc = s.Substring(start, end - start).TrimEnd('\\');

            // Strip last segment — it is always the permission group label, not a real folder
            // e.g. \\meainfs\qa\general\qagen\QA  →  \\meainfs\qa\general\qagen
            //      \\meaisdfs\SANAND_IT\secret\business_plan\SANAND_IT  →  \\meaisdfs\SANAND_IT\secret\business_plan
            var lastSlash = unc.LastIndexOf('\\');
            if (lastSlash > 2) // guard: don't strip the server name itself (\\server)
                unc = unc.Substring(0, lastSlash);

            return unc;
        }

        private string NormalizePath(string path)
        {
            var trimmed = path.Trim().TrimEnd('\\');
            var isUnc = trimmed.StartsWith(@"\\");
            var body = isUnc ? trimmed.Substring(2) : trimmed;
            body = Regex.Replace(body, @"\\+", @"\");
            return (isUnc ? @"\\" : "") + body.ToLowerInvariant();
        }

        private string GetDisplayName(string path)
        {
            var trimmed = path.TrimEnd('\\');
            var lastSlash = trimmed.LastIndexOf('\\');
            return lastSlash >= 0 ? trimmed.Substring(lastSlash + 1) : trimmed;
        }
    }
}