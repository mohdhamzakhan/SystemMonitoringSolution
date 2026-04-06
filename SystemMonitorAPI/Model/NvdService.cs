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

            // ── Strategy 1: Resolve CPE from NVD dictionary, then search ──
            string? cpe = await ResolveCpeAsync(normName, normPublisher, normVersion);

            if (cpe != null)
            {
                _logger.LogInformation("[NVD] Resolved CPE: {Cpe}", cpe);
                results = await SearchByCpeAsync(cpe);
            }

            // ── Strategy 2: Keyword search (no CPE found or CPE returned 0) ──
            if (results.Count == 0)
            {
                _logger.LogInformation("[NVD] Falling back to keyword search");
                results = await SearchByKeywordAsync(normName, normVersion);
            }

            // ── Strategy 3: Broader keyword — name only, no version ──
            if (results.Count == 0 && !string.IsNullOrEmpty(normVersion))
            {
                _logger.LogInformation("[NVD] Broadening keyword (no version)");
                results = await SearchByKeywordAsync(normName, version: null);
            }

            results = results.Take(MaxResults).ToList();

            _cache.Set(cacheKey, results, TimeSpan.FromHours(6));

            _logger.LogInformation(
                "[NVD] {Name} {Version} → {Count} CVEs", normName, normVersion, results.Count);

            return results;
        }

        // ═══════════════════════════════════════════════════════════════
        //  STRATEGY 1 — Discover the correct CPE from NVD's dictionary
        // ═══════════════════════════════════════════════════════════════

        /// <summary>
        /// Queries the NVD CPE dictionary to find the best-matching CPE name
        /// for a given software. This avoids all hardcoded vendor/product maps.
        /// </summary>
        private async Task<string?> ResolveCpeAsync(
            string softwareName,
            string publisher,
            string version)
        {
            // Build a search keyword: "chrome google 120" or just "chrome 120"
            string keyword = string.IsNullOrEmpty(publisher)
                ? $"{softwareName} {version}".Trim()
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

                // Pick the CPE whose title best matches our software name
                string? bestCpe = null;
                int bestScore = 0;

                foreach (var p in products.EnumerateArray())
                {
                    if (!p.TryGetProperty("cpe", out var cpeNode)) continue;

                    string? cpeName = cpeNode.TryGetProperty("cpeName", out var cn)
                        ? cn.GetString() : null;

                    if (string.IsNullOrEmpty(cpeName)) continue;

                    // Score by how many words in the software name appear in the CPE string
                    int score = ScoreCpeMatch(cpeName, softwareName, publisher);

                    if (score > bestScore)
                    {
                        bestScore = score;
                        bestCpe = cpeName;
                    }
                }

                if (bestCpe == null) return null;

                // Inject the real version into the resolved CPE
                // CPE format: cpe:2.3:a:{vendor}:{product}:{version}:...
                return InjectVersion(bestCpe, version);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[NVD] CPE resolution parse failed");
                return null;
            }
        }

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
                        Id = cve.TryGetProperty("id", out var id)
                                ? id.GetString() : null,

                        Description = ExtractEnglishDescription(cve),

                        Published = cve.TryGetProperty("published", out var pub)
                                ? pub.GetDateTime() : null
                    };

                    // CVSS: try V3.1 → V3.0 → V2.0
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
    }
}
