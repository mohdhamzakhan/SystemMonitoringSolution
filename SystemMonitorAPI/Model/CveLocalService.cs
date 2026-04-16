using System.IO.Compression;
using System.Text.Json;

namespace SystemMonitorAPI.Model
{
    // ─────────────────────────────────────────────────────────────
    //  Interface
    // ─────────────────────────────────────────────────────────────
    public interface ICveLocalService
    {
        /// <summary>
        /// Ensures the local CVE database is downloaded and up-to-date,
        /// then searches for CVEs matching the given vendor / product / version.
        /// </summary>
        Task<List<CveDto>> SearchAsync(string vendor, string product, string version);

        /// <summary>
        /// Force a fresh download + extraction of the CVE list, regardless of cache age.
        /// </summary>
        Task RefreshDatabaseAsync();
    }

    // ─────────────────────────────────────────────────────────────
    //  Implementation
    // ─────────────────────────────────────────────────────────────
    public class CveLocalService : ICveLocalService
    {
        // ── tunables ──────────────────────────────────────────────
        private const string ZipUrl =
            "https://github.com/CVEProject/cvelistV5/archive/refs/heads/main.zip";

        // How long before we re-download (default 24 h)
        private static readonly TimeSpan RefreshInterval = TimeSpan.FromHours(24);

        // ── paths (all inside a single "cve-db" folder) ───────────
        private readonly string _dbRoot;        // …/cve-db/
        private readonly string _zipPath;       // …/cve-db/cvelistV5.zip
        private readonly string _extractRoot;   // …/cve-db/extracted/
        private readonly string _cvesRoot;      // …/cve-db/extracted/cvelistV5-main/cves/
        private readonly string _stampPath;     // …/cve-db/last-updated.txt

        private readonly HttpClient _http;
        private readonly ILogger<CveLocalService> _logger;

        // ── in-memory index: CVE-ID → parsed DTO ─────────────────
        // Built once after extraction; keyed by lowercase "vendor::product"
        private Dictionary<string, List<CveDto>>? _index;
        private readonly SemaphoreSlim _lock = new(1, 1);

        public CveLocalService(
            IHttpClientFactory httpFactory,
            ILogger<CveLocalService> logger,
            IConfiguration config)
        {
            _http = httpFactory.CreateClient("cve-local");
            _logger = logger;

            // Allow override via appsettings, fall back to cc
            _dbRoot = config["CveLocal:DbRoot"]
                           ?? Path.Combine(Path.GetTempPath(), "cve-db");
            _zipPath = Path.Combine(_dbRoot, "cvelistV5.zip");
            _extractRoot = Path.Combine(_dbRoot, "extracted");
            _cvesRoot = Path.Combine(_extractRoot, "cvelistV5-main", "cves");
            _stampPath = Path.Combine(_dbRoot, "last-updated.txt");

            Directory.CreateDirectory(_dbRoot);
        }

        // ─────────────────────────────────────────────────────────
        //  Public API
        // ─────────────────────────────────────────────────────────

        public async Task<List<CveDto>> SearchAsync(
            string vendor, string product, string version)
        {
            await EnsureDatabaseReadyAsync();

            var results = new List<CveDto>();
            if (_index is null) return results;

            // Try exact "vendor::product" first, then just "product"
            var candidates = new List<CveDto>();

            string vp = IndexKey(vendor, product);
            string p = IndexKey("", product);

            if (_index.TryGetValue(vp, out var byVp)) candidates.AddRange(byVp);
            else if (_index.TryGetValue(p, out var byP)) candidates.AddRange(byP);

            // Version filter (if we have a version, keep only matching or
            // entries that have no version constraint at all)
            if (!string.IsNullOrEmpty(version))
            {
                candidates = candidates
                    .Where(c =>
                        c.AffectedVersions.Count == 0 ||
                        c.AffectedVersions.Any(av =>
                            VersionMatches(av, version)))
                    .ToList();
            }

            return candidates;
        }

        public async Task RefreshDatabaseAsync()
        {
            await _lock.WaitAsync();
            try
            {
                await DownloadZipAsync();
                await ExtractZipAsync();
                BuildIndex();
                await File.WriteAllTextAsync(
                    _stampPath,
                    DateTime.Now.ToString("O"));
            }
            finally
            {
                _lock.Release();
            }
        }

        // ─────────────────────────────────────────────────────────
        //  Internal helpers
        // ─────────────────────────────────────────────────────────

        private async Task EnsureDatabaseReadyAsync()
        {
            await _lock.WaitAsync();
            try
            {
                bool needsDownload = NeedsRefresh();

                if (needsDownload)
                {
                    _logger.LogInformation("[CveLocal] Database stale – downloading …");
                    await DownloadZipAsync();
                    await ExtractZipAsync();
                    await File.WriteAllTextAsync(
                        _stampPath,
                        DateTime.Now.ToString("O"));
                }

                if (_index is null)
                {
                    _logger.LogInformation("[CveLocal] Building in-memory index …");
                    BuildIndex();
                }
            }
            finally
            {
                _lock.Release();
            }
        }

        private bool NeedsRefresh()
        {
            // No zip or no extracted folder → always refresh
            if (!File.Exists(_zipPath) || !Directory.Exists(_cvesRoot))
                return true;

            // Check stamp file
            if (!File.Exists(_stampPath)) return true;

            var raw = File.ReadAllText(_stampPath).Trim();
            if (!DateTime.TryParse(raw, out var stamp)) return true;

            return DateTime.Now - stamp > RefreshInterval;
        }

        // ── Download ─────────────────────────────────────────────

        private async Task DownloadZipAsync()
        {
            _logger.LogInformation("[CveLocal] Downloading {Url} …", ZipUrl);
            Console.WriteLine($"\n[CveLocal] Starting download from:\n  {ZipUrl}\n");

            string tmp = _zipPath + ".tmp";

            if (File.Exists(_zipPath) && !File.Exists(tmp))
            {
                long existingMb = new FileInfo(_zipPath).Length / 1_048_576;
                Console.WriteLine($"[CveLocal] Zip already present ({existingMb} MB) — skipping download.\n");
                _logger.LogInformation("[CveLocal] Zip already present, skipping download.");
                return;
            }

            using var response = await _http.GetAsync(ZipUrl, HttpCompletionOption.ResponseHeadersRead);
            response.EnsureSuccessStatusCode();

            long? totalBytes = response.Content.Headers.ContentLength;
            string totalLabel = totalBytes.HasValue
                ? $"{totalBytes.Value / 1_048_576.0:F1} MB"
                : "unknown size";
            Console.WriteLine($"[CveLocal] Total size: {totalLabel}");

            await using var body = await response.Content.ReadAsStreamAsync();

            // ✅ Explicit block — FileStream is fully closed before File.Move below
            await using (var fs = new FileStream(
                tmp, FileMode.Create, FileAccess.Write, FileShare.None,
                bufferSize: 81_920))
            {
                var buffer = new byte[81_920];
                long downloaded = 0;
                int lastPct = -1;
                int read;
                var sw = System.Diagnostics.Stopwatch.StartNew();

                while ((read = await body.ReadAsync(buffer)) > 0)
                {
                    await fs.WriteAsync(buffer.AsMemory(0, read));
                    downloaded += read;

                    int pct = totalBytes.HasValue
                        ? (int)(downloaded * 100L / totalBytes.Value)
                        : -1;

                    if (pct != lastPct || sw.ElapsedMilliseconds >= 2_000)
                    {
                        lastPct = pct;
                        sw.Restart();
                        double mbDone = downloaded / 1_048_576.0;

                        if (totalBytes.HasValue)
                        {
                            int filled = pct / 5;
                            string bar = new string('█', filled) + new string('░', 20 - filled);
                            Console.Write($"\r  [{bar}] {pct,3}%  {mbDone:F1} / {totalBytes.Value / 1_048_576.0:F1} MB   ");
                        }
                        else
                        {
                            Console.Write($"\r  Downloaded {mbDone:F1} MB …   ");
                        }
                    }
                }

                // ✅ Flush explicitly before the using block closes the file
                await fs.FlushAsync();

            } // ← FileStream is fully closed/disposed HERE, before File.Move

            Console.WriteLine($"\r  [████████████████████] 100%  — download complete.      ");

            // ✅ Now safe to move — no handle open on the .tmp file
            try
            {
                File.Move(tmp, _zipPath, overwrite: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[CveLocal] Failed to move temp zip to final path.");
                throw;
            }

            long finalBytes = new FileInfo(_zipPath).Length;
            Console.WriteLine($"[CveLocal] Saved to: {_zipPath}  ({finalBytes / 1_048_576.0:F1} MB)\n");
            _logger.LogInformation("[CveLocal] Download complete ({MB:F1} MB).", finalBytes / 1_048_576.0);
        }

        // ── Extract ──────────────────────────────────────────────

        private Task ExtractZipAsync()
        {
            _logger.LogInformation("[CveLocal] Extracting zip …");
            Console.WriteLine("[CveLocal] Opening zip archive …");

            // ✅ Skip extraction if folder exists and was extracted within the last 24 hours
            if (Directory.Exists(_extractRoot))
            {
                var extractedAt = Directory.GetLastWriteTime(_extractRoot);
                if (DateTime.Now - extractedAt < TimeSpan.FromHours(24))
                {
                    Console.WriteLine($"[CveLocal] Extraction folder is fresh (last written: {extractedAt:g}) — skipping extraction.\n");
                    _logger.LogInformation("[CveLocal] Skipping extraction — folder is less than 24 h old.");
                    return Task.CompletedTask;
                }

                Console.WriteLine("[CveLocal] Extraction folder is stale — removing and re-extracting …");
                Directory.Delete(_extractRoot, recursive: true);
            }

            Directory.CreateDirectory(_extractRoot);

            using var archive = ZipFile.OpenRead(_zipPath);

            int total = archive.Entries.Count;
            int done = 0;
            int lastPct = -1;
            long bytesTotal = archive.Entries.Sum(e => e.Length);   // uncompressed
            long bytesDone = 0;
            var sw = System.Diagnostics.Stopwatch.StartNew();

            Console.WriteLine(
                $"[CveLocal] Extracting {total:N0} entries " +
                $"({bytesTotal / 1_048_576.0:F1} MB uncompressed) …\n");

            foreach (var entry in archive.Entries)
            {
                // Reconstruct directory structure
                string destPath = Path.GetFullPath(
                    Path.Combine(_extractRoot, entry.FullName));

                // Safety: prevent zip-slip
                if (!destPath.StartsWith(
                        Path.GetFullPath(_extractRoot) + Path.DirectorySeparatorChar,
                        StringComparison.OrdinalIgnoreCase))
                    continue;

                if (entry.FullName.EndsWith('/') || entry.FullName.EndsWith('\\'))
                {
                    // Directory entry
                    Directory.CreateDirectory(destPath);
                }
                else
                {
                    Directory.CreateDirectory(
                        Path.GetDirectoryName(destPath)!);
                    entry.ExtractToFile(destPath, overwrite: true);
                }

                done++;
                bytesDone += entry.Length;

                // ── progress bar (every 1 % or every 2 s) ────────
                int pct = (int)(done * 100L / total);
                if (pct != lastPct || sw.ElapsedMilliseconds >= 2_000)
                {
                    lastPct = pct;
                    sw.Restart();

                    int filled = pct / 5;
                    string bar = new string('█', filled) + new string('░', 20 - filled);
                    double mbDone = bytesDone / 1_048_576.0;
                    double mbTotal = bytesTotal / 1_048_576.0;

                    Console.Write(
                        $"\r  [{bar}] {pct,3}%  {done:N0}/{total:N0} files  " +
                        $"{mbDone:F1}/{mbTotal:F1} MB   ");
                }
            }

            Console.WriteLine(
                $"\r  [████████████████████] 100%  {total:N0} files extracted.      \n");

            _logger.LogInformation(
                "[CveLocal] Extraction complete. CVEs root: {Root}", _cvesRoot);

            return Task.CompletedTask;
        }

        // ── Index ────────────────────────────────────────────────
        // Folder layout:  cvelistV5-main/cves/{year}/{2-digit-prefix}/CVE-xxxx-xxxxx.json
        //
        // We build a Dictionary<"vendor::product", List<CveDto>>
        // so lookups are O(1) regardless of how many files exist.

        private void BuildIndex()
        {
            if (!Directory.Exists(_cvesRoot))
            {
                _logger.LogWarning("[CveLocal] CVEs root not found: {Root}", _cvesRoot);
                _index = new();
                return;
            }

            var index = new Dictionary<string, List<CveDto>>(StringComparer.OrdinalIgnoreCase);
            int parsed = 0;
            int failed = 0;
            int lastPct = -1;
            var sw = System.Diagnostics.Stopwatch.StartNew();

            var allFiles = Directory
                .EnumerateFiles(_cvesRoot, "*.json", SearchOption.AllDirectories)
                .ToList();

            int total = allFiles.Count;
            Console.WriteLine($"\n[CveLocal] Indexing {total:N0} CVE JSON files …\n");

            for (int i = 0; i < total; i++)
            {
                try
                {
                    var dto = ParseCveFile(allFiles[i]);
                    if (dto is null) continue;

                    // Index under every (vendor, product) pair found in the JSON
                    foreach (var key in dto.IndexKeys)
                    {
                        if (!index.TryGetValue(key, out var list))
                        {
                            list = new List<CveDto>();
                            index[key] = list;
                        }
                        list.Add(dto);
                    }

                    parsed++;
                }
                catch (Exception ex)
                {
                    failed++;
                    _logger.LogDebug(ex, "[CveLocal] Failed to parse {File}", allFiles[i]);
                }

                // ── progress bar (every 1 % or every 2 s) ────────
                int pct = (int)((i + 1) * 100L / total);
                if (pct != lastPct || sw.ElapsedMilliseconds >= 2_000)
                {
                    lastPct = pct;
                    sw.Restart();

                    int filled = pct / 5;
                    string bar = new string('█', filled) + new string('░', 20 - filled);
                    Console.Write(
                        $"\r  [{bar}] {pct,3}%  {i + 1:N0}/{total:N0} files  " +
                        $"✔ {parsed:N0} indexed  ✖ {failed:N0} skipped   ");
                }
            }

            Console.WriteLine(
                $"\r  [████████████████████] 100%  ✔ {parsed:N0} CVEs indexed  " +
                $"✖ {failed:N0} skipped  →  {index.Count:N0} lookup keys\n");

            _index = index;
            _logger.LogInformation(
                "[CveLocal] Index built: {Parsed:N0} CVEs, {Failed:N0} skipped, {Keys:N0} keys.",
                parsed, failed, index.Count);
        }

        // ── Parse a single CVE JSON file ─────────────────────────
        // Matches the schema shown in the sample (CVE 5.x format)

        private CveDto? ParseCveFile(string filePath)
        {
            using var stream = File.OpenRead(filePath);
            using var doc = JsonDocument.Parse(stream);
            var root = doc.RootElement;

            // ── metadata ─────────────────────────────────────────
            if (!root.TryGetProperty("cveMetadata", out var meta)) return null;

            string? cveId = meta.TryGetProperty("cveId", out var idProp)
                ? idProp.GetString() : null;

            if (string.IsNullOrEmpty(cveId)) return null;

            string state = meta.TryGetProperty("state", out var stProp)
                ? stProp.GetString() ?? "" : "";

            // Skip rejected / reserved
            if (state.Equals("REJECTED", StringComparison.OrdinalIgnoreCase))
                return null;

            DateTime? published = meta.TryGetProperty("datePublished", out var pubProp) &&
                                  DateTime.TryParse(pubProp.GetString(), out var dt)
                ? dt : null;

            // ── CNA container ─────────────────────────────────────
            if (!root.TryGetProperty("containers", out var containers)) return null;
            if (!containers.TryGetProperty("cna", out var cna)) return null;

            // Description
            string? description = null;
            if (cna.TryGetProperty("descriptions", out var descs))
            {
                foreach (var d in descs.EnumerateArray())
                {
                    if (d.TryGetProperty("lang", out var lang) &&
                        lang.GetString()?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        description = d.TryGetProperty("value", out var val)
                            ? val.GetString() : null;
                        break;
                    }
                }
            }

            // CVSS score + severity  (cvssV3_1 preferred, fall back to cvssV3_0 / cvssV2)
            double score = 0;
            string? severity = null;

            if (cna.TryGetProperty("metrics", out var metrics))
            {
                foreach (var m in metrics.EnumerateArray())
                {
                    if (m.TryGetProperty("cvssV3_1", out var c31)) { (score, severity) = ReadCvss(c31); break; }
                    else if (m.TryGetProperty("cvssV3_0", out var c30)) { (score, severity) = ReadCvss(c30); break; }
                    else if (m.TryGetProperty("cvssV2", out var c2)) { (score, severity) = ReadCvss(c2); break; }
                }
            }

            // Affected products + versions
            var indexKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var affectedVersions = new List<string>();

            if (cna.TryGetProperty("affected", out var affected))
            {
                foreach (var aff in affected.EnumerateArray())
                {
                    string vendor = aff.TryGetProperty("vendor", out var vp) ? vp.GetString()?.ToLower() ?? "" : "";
                    string product = aff.TryGetProperty("product", out var pp) ? pp.GetString()?.ToLower().Replace(" ", "_") ?? "" : "";

                    if (!string.IsNullOrEmpty(product))
                    {
                        indexKeys.Add(IndexKey(vendor, product));
                        indexKeys.Add(IndexKey("", product));          // also index by product-only
                    }

                    if (aff.TryGetProperty("versions", out var versions))
                    {
                        foreach (var v in versions.EnumerateArray())
                        {
                            if (v.TryGetProperty("version", out var vv))
                            {
                                var vStr = vv.GetString();
                                if (!string.IsNullOrEmpty(vStr))
                                    affectedVersions.Add(vStr);
                            }
                        }
                    }
                }
            }

            return new CveDto
            {
                Id = cveId,
                Description = description,
                Score = score,
                Severity = severity,
                Published = published,
                Source = "LOCAL",
                AffectedVersions = affectedVersions,
                IndexKeys = indexKeys.ToList()
            };
        }

        // ── CVSS helpers ─────────────────────────────────────────

        private static (double score, string? severity) ReadCvss(JsonElement node)
        {
            double score = node.TryGetProperty("baseScore", out var bs)
                ? bs.GetDouble() : 0;

            string? severity = node.TryGetProperty("baseSeverity", out var sev)
                ? sev.GetString()?.ToUpper() : null;

            return (score, severity);
        }

        // ── Version matching ─────────────────────────────────────
        // Simple prefix match:  "10.0.1" matches "10.0.1", "10.0", "10" etc.

        private static bool VersionMatches(string affectedVersion, string queryVersion)
        {
            if (string.IsNullOrEmpty(affectedVersion)) return true;

            // Exact match
            if (string.Equals(affectedVersion, queryVersion, StringComparison.OrdinalIgnoreCase))
                return true;

            // Major.Minor prefix match
            var qParts = queryVersion.Split('.');
            var aParts = affectedVersion.Split('.');
            int common = Math.Min(qParts.Length, aParts.Length);

            for (int i = 0; i < common; i++)
                if (!string.Equals(qParts[i], aParts[i], StringComparison.OrdinalIgnoreCase))
                    return false;

            return true;
        }

        private static string IndexKey(string vendor, string product)
            => $"{vendor.ToLower()}::{product.ToLower()}";
    }
}