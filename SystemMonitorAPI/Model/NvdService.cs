using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;

namespace SystemMonitorAPI.Model
{
    public interface INvdService
    {
        Task<List<CveDto>> GetCvesAsync(string softwareName, string publisher, string version);
    }

    public class NvdService : INvdService
    {
        private readonly HttpClient _http;
        private readonly IMemoryCache _cache;
        private readonly ILogger<NvdService> _logger;
        private readonly IConfiguration _config;

        // How many CVEs max per software entry
        private const int MaxResults = 20;

        public NvdService(
            HttpClient http,
            IMemoryCache cache,
            ILogger<NvdService> logger,
            IConfiguration config)
        {
            _http = http;
            _cache = cache;
            _logger = logger;
            _config = config;
        }

        // ═══════════════════════════════════════════════════════════════
        //  PUBLIC ENTRY POINT
        // ═══════════════════════════════════════════════════════════════

        public async Task<List<CveDto>> GetCvesAsync(
            string softwareName,
            string publisher,
            string version)
        {
            string normName = NormalizeName(softwareName);
            string normPublisher = NormalizeName(publisher);
            string normVersion = NormalizeVersion(version);

            string cacheKey = $"nvd:{normPublisher}:{normName}:{normVersion}";

            if (_cache.TryGetValue(cacheKey, out List<CveDto> cached))
            {
                _logger.LogInformation("[NVD] Cache hit → {Key}", cacheKey);
                return cached;
            }

            List<CveDto> results = new();

            // ── Strategy 1: Resolve CPE vendor:product, then use virtualMatchString ──
            // virtualMatchString tells NVD "find CVEs affecting this product AT this version"
            string? baseCpe = await ResolveCpeBaseAsync(normName, normPublisher);

            if (baseCpe != null)
            {
                _logger.LogInformation("[NVD] Base CPE resolved: {Cpe}", baseCpe);

                // ✅ Use virtualMatchString with version — NVD handles version range logic
                results = await SearchByVirtualCpeAsync(baseCpe, normVersion);

                _logger.LogInformation("[NVD] virtualMatchString returned {Count} CVEs", results.Count);
            }

            // ── Strategy 2: Keyword search + strict version filter ──
            if (results.Count == 0)
            {
                _logger.LogInformation("[NVD] Falling back to keyword search");
                results = await SearchByKeywordAsync(normName, normVersion);

                if (!string.IsNullOrEmpty(normVersion) && normVersion != "*")
                    results = FilterByVersion(results, normVersion);

                _logger.LogInformation("[NVD] Keyword search returned {Count} CVEs after filter", results.Count);
            }

            // ── Strategy 3: Base CPE without version (broader, still filter) ──
            if (results.Count == 0 && baseCpe != null)
            {
                _logger.LogInformation("[NVD] Strategy 3: CPE without version filter");
                var broad = await SearchByVirtualCpeAsync(baseCpe, version: null);
                results = FilterByVersion(broad, normVersion);
                _logger.LogInformation("[NVD] Strategy 3 returned {Count} CVEs after filter", results.Count);
            }

            results = results
                .GroupBy(r => r.Id)         // deduplicate
                .Select(g => g.First())
                .Take(MaxResults)
                .ToList();

            _cache.Set(cacheKey, results, TimeSpan.FromHours(6));

            _logger.LogInformation("[NVD] FINAL {Name} {Version} → {Count} CVEs",
                normName, normVersion, results.Count);

            return results;
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 1a — Resolve only vendor:product (no version)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Returns a base CPE like "cpe:2.3:a:google:chrome" (no version).
        /// Version is handled separately by virtualMatchString.
        /// </summary>
        private async Task<string?> ResolveCpeBaseAsync(string softwareName, string publisher)
        {
            string keyword = string.IsNullOrEmpty(publisher)
                ? softwareName.Trim()
                : $"{softwareName} {publisher}".Trim();

            string url = $"https://services.nvd.nist.gov/rest/json/cpes/2.0" +
                         $"?keywordSearch={Uri.EscapeDataString(keyword)}" +
                         $"&resultsPerPage=5";

            string json = await FetchAsync(url);
            if (string.IsNullOrEmpty(json) || json == "{}") return null;

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("products", out var products)) return null;

                string? bestCpe = null;
                int bestScore = 0;

                foreach (var p in products.EnumerateArray())
                {
                    if (!p.TryGetProperty("cpe", out var cpeNode)) continue;

                    string? cpeName = cpeNode.TryGetProperty("cpeName", out var cn)
                        ? cn.GetString() : null;

                    if (string.IsNullOrEmpty(cpeName)) continue;

                    int score = ScoreCpeMatch(cpeName, softwareName, publisher);
                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestCpe = cpeName;
                    }
                }

                if (bestCpe == null) return null;

                // ✅ Return ONLY vendor:product part — strip version and trailing fields
                // cpe:2.3:a:google:chrome:108.0.1:*:*:... → cpe:2.3:a:google:chrome
                var parts = bestCpe.Split(':');
                if (parts.Length >= 5)
                    return $"{parts[0]}:{parts[1]}:{parts[2]}:{parts[3]}:{parts[4]}";

                return bestCpe;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[NVD] CPE base resolution failed");
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 1b — virtualMatchString (version-aware NVD query)
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Uses NVD's virtualMatchString which correctly handles version ranges.
        /// e.g. cpe:2.3:a:google:chrome:108.0.5359 will match CVEs that affect
        /// that specific version even via versionStartIncluding/versionEndExcluding.
        /// </summary>
        private async Task<List<CveDto>> SearchByVirtualCpeAsync(string baseCpe, string? version)
        {
            // Build: cpe:2.3:a:google:chrome:108.0.5359:*:*:*:*:*:*:*
            string virtualCpe = string.IsNullOrEmpty(version) || version == "*"
                ? $"{baseCpe}:*:*:*:*:*:*:*:*"
                : $"{baseCpe}:{version}:*:*:*:*:*:*:*";

            string url = $"https://services.nvd.nist.gov/rest/json/cves/2.0" +
                         $"?virtualMatchString={Uri.EscapeDataString(virtualCpe)}" +
                         $"&resultsPerPage={MaxResults}";

            _logger.LogInformation("[NVD] virtualMatchString URL: {Url}", url);

            string json = await FetchAsync(url);
            return ParseCves(json);
        }

        // ═══════════════════════════════════════════════════════════════
        //  VERSION FILTER — post-fetch safety net
        // ═══════════════════════════════════════════════════════════════

        private List<CveDto> FilterByVersion(List<CveDto> cves, string normVersion)
        {
            if (string.IsNullOrEmpty(normVersion) || normVersion == "*")
                return cves;

            var variants = BuildVersionVariants(normVersion);

            return cves.Where(cve =>
            {
                // Check description
                if (!string.IsNullOrEmpty(cve.Description))
                    foreach (var v in variants)
                        if (cve.Description.Contains(v, StringComparison.OrdinalIgnoreCase))
                            return true;

                // Check extracted CPE strings
                foreach (var cpe in cve.AffectedCpes)
                    foreach (var v in variants)
                        if (cpe.Contains(v, StringComparison.OrdinalIgnoreCase))
                            return true;

                return false;
            }).ToList();
        }

        private List<string> BuildVersionVariants(string version)
        {
            var variants = new List<string> { version };
            var parts = version.Split('.');

            if (parts.Length >= 2) variants.Add($"{parts[0]}.{parts[1]}");
            if (parts.Length >= 1) variants.Add(parts[0]);

            return variants;
        }

        // ═══════════════════════════════════════════════════════════════
        //  UPDATED CPE RESOLUTION — pass version separately for injection
        // ═══════════════════════════════════════════════════════════════

        private async Task<string?> ResolveCpeAsync(
            string softwareName,
            string publisher,
            string version)
        {
            // ✅ Search WITHOUT version in keyword — version goes into CPE after
            string keyword = string.IsNullOrEmpty(publisher)
                ? softwareName.Trim()
                : $"{softwareName} {publisher}".Trim();

            string url = $"https://services.nvd.nist.gov/rest/json/cpes/2.0" +
                         $"?keywordSearch={Uri.EscapeDataString(keyword)}" +
                         $"&resultsPerPage=5";

            string json = await FetchAsync(url);

            if (string.IsNullOrEmpty(json) || json == "{}") return null;

            try
            {
                using var doc = JsonDocument.Parse(json);

                if (!doc.RootElement.TryGetProperty("products", out var products))
                    return null;

                string? bestCpe = null;
                int bestScore = 0;

                foreach (var p in products.EnumerateArray())
                {
                    if (!p.TryGetProperty("cpe", out var cpeNode)) continue;

                    string? cpeName = cpeNode.TryGetProperty("cpeName", out var cn)
                        ? cn.GetString() : null;

                    if (string.IsNullOrEmpty(cpeName)) continue;

                    int score = ScoreCpeMatch(cpeName, softwareName, publisher);

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestCpe = cpeName;
                    }
                }

                if (bestCpe == null) return null;

                // ✅ Inject EXACT version into the CPE string
                return InjectVersion(bestCpe, version);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[NVD] CPE resolution parse failed");
                return null;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 1 — Discover the correct CPE from NVD's dictionary
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Scores how well a CPE string matches the software we're looking for.
        /// Higher = better match.
        /// </summary>
        private int ScoreCpeMatch(string cpe, string softwareName, string publisher)
        {
            int score = 0;
            string cpeLower = cpe.ToLower();

            // Each word of the software name that appears in the CPE adds points
            foreach (var word in Tokenize(softwareName))
                if (cpeLower.Contains(word)) score += 2;

            // Publisher words add 1 point each (less weight)
            foreach (var word in Tokenize(publisher))
                if (cpeLower.Contains(word)) score += 1;

            return score;
        }

        /// <summary>
        /// Takes a resolved CPE (possibly with a wildcard version) and
        /// replaces the version segment with the actual version.
        /// cpe:2.3:a:google:chrome:*:... → cpe:2.3:a:google:chrome:120.0.1:...
        /// </summary>
        private string InjectVersion(string cpe, string version)
        {
            if (string.IsNullOrEmpty(version) || version == "*") return cpe;

            var parts = cpe.Split(':');
            // CPE 2.3: cpe:2.3:type:vendor:product:version:...
            //  index:   0   1    2    3       4       5
            if (parts.Length >= 6)
                parts[5] = NormalizeVersion(version);

            return string.Join(':', parts);
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 2 — Search CVEs by CPE name
        // ═══════════════════════════════════════════════════════════════

        private async Task<List<CveDto>> SearchByCpeAsync(string cpe)
        {
            string url = $"https://services.nvd.nist.gov/rest/json/cves/2.0" +
                         $"?cpeName={Uri.EscapeDataString(cpe)}" +
                         $"&resultsPerPage={MaxResults}";

            string json = await FetchAsync(url);
            return ParseCves(json);
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 3 — Keyword search
        // ═══════════════════════════════════════════════════════════════

        private async Task<List<CveDto>> SearchByKeywordAsync(string name, string? version)
        {
            string keyword = string.IsNullOrEmpty(version)
                ? name
                : $"{name} {version}";

            string url = $"https://services.nvd.nist.gov/rest/json/cves/2.0" +
                         $"?keywordSearch={Uri.EscapeDataString(keyword)}" +
                         $"&resultsPerPage={MaxResults}";

            string json = await FetchAsync(url);
            return ParseCves(json);
        }

        // ═══════════════════════════════════════════════════════════════
        //  HTTP — Fetch with rate-limit handling & retry
        // ═══════════════════════════════════════════════════════════════

        private async Task<string> FetchAsync(string url)
        {
            string? apiKey = _config["Nvd:ApiKey"];

            // Append API key if available
            string requestUrl = !string.IsNullOrEmpty(apiKey)
                ? url + "&apiKey=" + apiKey
                : url;

            // Without API key: 5 req/30s → wait 6s between requests
            // With API key:   50 req/30s → wait 0.6s
            int baseDelay = string.IsNullOrEmpty(apiKey) ? 6000 : 600;
            int delay = baseDelay;

            for (int attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    var response = await _http.GetAsync(requestUrl);

                    switch (response.StatusCode)
                    {
                        case System.Net.HttpStatusCode.NotFound:
                            return "{}";

                        case System.Net.HttpStatusCode.TooManyRequests:
                            _logger.LogWarning("[NVD] Rate limited — waiting {Ms}ms", delay);
                            await Task.Delay(delay);
                            delay *= 2;
                            continue;

                        case System.Net.HttpStatusCode.Forbidden:
                            _logger.LogError("[NVD] 403 Forbidden — check API key");
                            return "{}";
                    }

                    response.EnsureSuccessStatusCode();
                    return await response.Content.ReadAsStringAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[NVD] Attempt {N} failed", attempt);

                    if (attempt == 3) return "{}";

                    await Task.Delay(delay);
                    delay *= 2;
                }
            }

            return "{}";
        }

        // ═══════════════════════════════════════════════════════════════
        //  PARSE — NVD CVE response → List<CveDto>
        // ═══════════════════════════════════════════════════════════════

        private List<CveDto> ParseCves(string json)
        {
            var list = new List<CveDto>();
            if (string.IsNullOrWhiteSpace(json) || json == "{}") return list;

            try
            {
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("vulnerabilities", out var vulns))
                    return list;

                foreach (var v in vulns.EnumerateArray())
                {
                    if (!v.TryGetProperty("cve", out var cve)) continue;

                    var dto = new CveDto
                    {
                        Id = cve.TryGetProperty("id", out var id) ? id.GetString() : null,
                        Description = ExtractEnglishDescription(cve),
                        Published = cve.TryGetProperty("published", out var pub) ? pub.GetDateTime() : null,

                        // ✅ Extract all CPE strings from configurations
                        AffectedCpes = ExtractCpeStrings(cve),
                    };

                    if (cve.TryGetProperty("metrics", out var metrics))
                        ExtractBestCvss(metrics, dto);

                    if (!string.IsNullOrEmpty(dto.Id))
                        list.Add(dto);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[NVD] Parse failed");
            }

            return list;
        }

        // ✅ NEW — pulls all cpe23Uri / cpeName strings from configurations
        private List<string> ExtractCpeStrings(JsonElement cve)
        {
            var cpes = new List<string>();

            try
            {
                if (!cve.TryGetProperty("configurations", out var configs)) return cpes;

                foreach (var config in configs.EnumerateArray())
                {
                    if (!config.TryGetProperty("nodes", out var nodes)) continue;

                    foreach (var node in nodes.EnumerateArray())
                    {
                        if (!node.TryGetProperty("cpeMatch", out var matches)) continue;

                        foreach (var match in matches.EnumerateArray())
                        {
                            // Try both field names NVD uses
                            if (match.TryGetProperty("criteria", out var c)) cpes.Add(c.GetString() ?? "");
                            if (match.TryGetProperty("cpe23Uri", out var u)) cpes.Add(u.GetString() ?? "");
                            if (match.TryGetProperty("versionStartIncluding", out var vs)) cpes.Add(vs.GetString() ?? "");
                            if (match.TryGetProperty("versionEndIncluding", out var ve)) cpes.Add(ve.GetString() ?? "");
                            if (match.TryGetProperty("versionEndExcluding", out var vx)) cpes.Add(vx.GetString() ?? "");
                        }
                    }
                }
            }
            catch { /* safe to ignore */ }

            return cpes.Where(s => !string.IsNullOrEmpty(s)).ToList();
        }

        private string? ExtractEnglishDescription(JsonElement cve)
        {
            if (!cve.TryGetProperty("descriptions", out var descs)) return null;

            foreach (var d in descs.EnumerateArray())
                if (d.TryGetProperty("lang", out var lang) && lang.GetString() == "en")
                    if (d.TryGetProperty("value", out var val))
                        return val.GetString();

            return null;
        }

        private void ExtractBestCvss(JsonElement metrics, CveDto dto)
        {
            // Try each version in priority order
            if (TryExtractCvss(metrics, "cvssMetricV31", isV2: false, dto)) return;
            if (TryExtractCvss(metrics, "cvssMetricV30", isV2: false, dto)) return;
            TryExtractCvss(metrics, "cvssMetricV2", isV2: true, dto);
        }

        private bool TryExtractCvss(JsonElement metrics, string key, bool isV2, CveDto dto)
        {
            if (!metrics.TryGetProperty(key, out var arr)) return false;

            var first = arr.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.Undefined) return false;

            if (!first.TryGetProperty("cvssData", out var data)) return false;

            dto.Score = data.TryGetProperty("baseScore", out var s)
                ? s.GetDouble() : null;

            // V3 → baseSeverity inside cvssData
            // V2 → baseSeverity on the metric object itself
            if (!isV2)
            {
                dto.Severity = data.TryGetProperty("baseSeverity", out var sv)
                    ? sv.GetString() : null;
            }
            else
            {
                dto.Severity = first.TryGetProperty("baseSeverity", out var sv2)
                    ? sv2.GetString()
                    : ScoreToSeverity(dto.Score);
            }

            return true;
        }

        // ═══════════════════════════════════════════════════════════════
        //  NORMALIZATION HELPERS — generic, no hardcoded maps
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Cleans a raw name for use as a search keyword.
        /// "Microsoft Visual C++ 2019 Redistributable" → "microsoft visual c++ 2019 redistributable"
        /// </summary>
        private string NormalizeName(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return "";

            return raw.Trim().ToLower();
        }

        private string NormalizeVersion(string? version)
        {
            if (string.IsNullOrWhiteSpace(version)) return "*";

            // "1.2.3.4-beta" → "1.2.3"
            version = version.Split('-')[0].Trim();

            var parts = version.Split('.');
            return parts.Length >= 3
                ? $"{parts[0]}.{parts[1]}.{parts[2]}"
                : version;
        }

        /// <summary>
        /// Splits a name into meaningful tokens, dropping short/common words.
        /// "Microsoft Visual Studio Code" → ["microsoft", "visual", "studio", "code"]
        /// </summary>
        private IEnumerable<string> Tokenize(string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
                return Enumerable.Empty<string>();

            var stopWords = new HashSet<string>
                { "the", "inc", "llc", "ltd", "corp", "corporation",
                  "software", "foundation", "group", "gmbh", "co", "and" };

            return text.ToLower()
                       .Split(new[] { ' ', ',', '.', '(', ')' },
                              StringSplitOptions.RemoveEmptyEntries)
                       .Where(w => w.Length > 2 && !stopWords.Contains(w));
        }

        private string? ScoreToSeverity(double? score) => score switch
        {
            >= 9.0 => "CRITICAL",
            >= 7.0 => "HIGH",
            >= 4.0 => "MEDIUM",
            > 0 => "LOW",
            _ => null
        };
    }

    public class CveDto
    {
        public string Id { get; set; }
        public string Description { get; set; }
        public string Severity { get; set; }
        public double? Score { get; set; }
        public DateTime? Published { get; set; }
        public string Source { get; set; }

        // ✅ NEW — CPE strings extracted during parse for version filtering
        public List<string> AffectedCpes { get; set; } = new();

        /// <summary>All version strings from the CVE's "affected" block.</summary>
        public List<string> AffectedVersions { get; set; } = new();

        /// <summary>Pre-computed index keys ("vendor::product") for fast lookup.</summary>
        public List<string> IndexKeys { get; set; } = new();
    }
}
