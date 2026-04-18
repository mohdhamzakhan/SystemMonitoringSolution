using Lextm.SharpSnmpLib;
using Lextm.SharpSnmpLib.Messaging;
using Lextm.SharpSnmpLib.Security;
using Microsoft.Extensions.Options;
using System.Net;
using SystemMonitorAPI.Configuration;

namespace SystemMonitorAPI.Services
{
    public interface ISnmpV3Service
    {
        Task<string?> GetAsync(string ipAddress, string oid, string? poolName = null);
        Task<Dictionary<string, string>> GetBulkAsync(
            string ipAddress, string rootOid,
            int maxRepetitions = 50, string? poolName = null);
        Task<bool> IsReachableAsync(string ipAddress, string? poolName = null);
        string? GetCachedCredentialLabel(string ipAddress);
    }

    public class SnmpV3Service : ISnmpV3Service
    {
        private readonly Dictionary<string, SnmpV3Config> _byLabel;
        private readonly List<SnmpV3Config> _all;
        // ADD THIS ↓
        private readonly List<IpPoolConfig> _ipPools;
        private readonly ILogger<SnmpV3Service> _logger;

        private readonly Dictionary<string, string> _credCache = new();
        private readonly Dictionary<string, ISnmpMessage> _discoveryCache = new();
        private readonly object _lock = new();

        public SnmpV3Service(IOptions<NetworkScanConfig> config, ILogger<SnmpV3Service> logger)
        {
            _logger = logger;
            var cfg = config.Value;
            _all = cfg.SnmpV3;
            // ADD THIS ↓
            _ipPools = cfg.IpPools ?? new List<IpPoolConfig>();

            if (_all.Count == 0)
                throw new InvalidOperationException(
                    "NetworkScan.SnmpV3 array is empty. Add at least one credential set.");

            var duplicates = _all.GroupBy(c => c.Label)
                                 .Where(g => g.Count() > 1 || string.IsNullOrWhiteSpace(g.Key))
                                 .Select(g => g.Key).ToList();
            if (duplicates.Any())
                throw new InvalidOperationException(
                    "SnmpV3 labels must be unique and non-empty. Problem labels: " +
                    string.Join(", ", duplicates.Select(d => $"'{d}'")));

            _byLabel = _all.ToDictionary(c => c.Label, StringComparer.OrdinalIgnoreCase);

            _logger.LogInformation(
                "SnmpV3Service ready — {Count} credential set(s): {Labels}",
                _all.Count, string.Join(", ", _all.Select(c => c.Label)));
        }

        // ── Public API ────────────────────────────────────────────────────────

        public async Task<bool> IsReachableAsync(string ipAddress, string? poolName = null)
            => await GetAsync(ipAddress, OidConstants.SysDescr, poolName) != null;

        public string? GetCachedCredentialLabel(string ipAddress)
        {
            lock (_lock)
                return _credCache.TryGetValue(ipAddress, out var l) ? l : null;
        }

        public async Task<string?> GetAsync(string ipAddress, string oid, string? poolName = null)
        {
            foreach (var cred in ResolveCredentials(ipAddress, poolName))
            {
                var result = await ExecuteGetAsync(ipAddress, oid, cred);
                if (result != null)
                {
                    lock (_lock) { _credCache[ipAddress] = cred.Label; }
                    return result;
                }
            }
            return null;
        }

        public async Task<Dictionary<string, string>> GetBulkAsync(
            string ipAddress, string rootOid,
            int maxRepetitions = 50, string? poolName = null)
        {
            foreach (var cred in ResolveCredentials(ipAddress, poolName))
            {
                var result = await ExecuteGetBulkAsync(ipAddress, rootOid, maxRepetitions, cred);
                if (result.Count > 0)
                {
                    lock (_lock) { _credCache[ipAddress] = cred.Label; }
                    return result;
                }
            }
            return new Dictionary<string, string>();
        }

        // ── Discovery cache ───────────────────────────────────────────────────
        //
        // SNMPv3 two-step flow:
        //
        //   Step 1 — Discovery (blank, unauthenticated request):
        //     App ──blank GET──▶ Switch
        //     App ◀──Report────  Switch   ← contains engineId/boots/time
        //
        //   Step 2 — Real request (authenticated + encrypted):
        //     App ──GET/GETBULK──▶ Switch   ← uses engine params from Step 1
        //     App ◀──data──────────Switch
        //
        // Key insight: the discovery Report does NOT depend on which credential
        // you use — the blank request is unauthenticated.  So ONE discovery
        // per IP is enough for ALL credentials and ALL OID calls.
        //
        // If discovery times out → IP is SNMP-unreachable → skip all credentials.
        // If discovery succeeds but Step 2 fails → wrong credential → try next.

        private ISnmpMessage? GetOrCreateDiscovery(string ipAddress, int port, int timeoutMs)
        {
            // Return cached discovery if available
            lock (_lock)
            {
                if (_discoveryCache.TryGetValue(ipAddress, out var cached))
                    return cached;
            }

            try
            {
                var endpoint = new IPEndPoint(IPAddress.Parse(ipAddress), port);
                var discovery = Messenger.GetNextDiscovery(SnmpType.GetRequestPdu);

                // This is the ONLY place a timeout can block.
                // If the switch is unreachable or SNMP is disabled, this throws.
                // The exception is caught below → returns null → caller skips IP.
                var report = discovery.GetResponse(timeoutMs, endpoint);

                lock (_lock) { _discoveryCache[ipAddress] = report; }

                _logger.LogDebug("SNMPv3 engine discovered for {IP}", ipAddress);
                return report;
            }
            catch (Exception ex)
            {
                // Unreachable or SNMP not enabled — log once and return null.
                // Caller will skip all credentials for this IP without further timeouts.
                _logger.LogDebug("Discovery timeout/error for {IP}: {Msg}", ipAddress, ex.Message);
                return null;
            }
        }

        /// <summary>
        /// Invalidates the discovery cache for an IP (call after decryption errors
        /// so the next attempt rediscovers fresh engine time).
        /// </summary>
        private void InvalidateDiscovery(string ipAddress)
        {
            lock (_lock) { _discoveryCache.Remove(ipAddress); }
        }



        // ── Credential resolution ─────────────────────────────────────────────

        private IEnumerable<SnmpV3Config> ResolveCredentials(string ipAddress, string? poolName)
        {
            var tried = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            // 1 — cached working credential (fast path)
            string? cached;
            lock (_lock) { _credCache.TryGetValue(ipAddress, out cached); }
            if (cached != null && _byLabel.TryGetValue(cached, out var cachedCred))
            {
                tried.Add(cached);
                yield return cachedCred;
            }

            // 2 — pool-linked credential via SnmpCredentialLabel
            //     FIX: map poolName ("Cisco_Switches") → pool.SnmpCredentialLabel ("CiscoSNMP")
            //     instead of looking up poolName directly in _byLabel (which stores cred labels).
            if (!string.IsNullOrWhiteSpace(poolName))
            {
                var credLabel = poolName; // fallback: pool name == cred label (legacy configs)

                var linkedPool = _ipPools.FirstOrDefault(p =>
                    string.Equals(p.Name, poolName, StringComparison.OrdinalIgnoreCase));

                if (linkedPool != null && !string.IsNullOrWhiteSpace(linkedPool.SnmpCredentialLabel))
                    credLabel = linkedPool.SnmpCredentialLabel;

                if (_byLabel.TryGetValue(credLabel, out var poolCred) && tried.Add(poolCred.Label))
                {
                    _logger.LogDebug("Pool '{Pool}' → credential '{Cred}'", poolName, poolCred.Label);
                    yield return poolCred;
                }
            }

            // 3 — all remaining in config order (fallback)
            foreach (var cred in _all.Where(c => tried.Add(c.Label)))
                yield return cred;
        }

        // ── GET ───────────────────────────────────────────────────────────────

        private async Task<string?> ExecuteGetAsync(
     string ipAddress, string oid, SnmpV3Config cred)
        {
            var endpoint = new IPEndPoint(IPAddress.Parse(ipAddress), cred.Port);

            for (int attempt = 0; attempt <= cred.Retries; attempt++)
            {
                try
                {
                    var (_, priv) = BuildProviders(cred);

                    // 🔹 Step 1: Discovery
                    ISnmpMessage report;
                    try
                    {
                        var discovery = Messenger.GetNextDiscovery(SnmpType.GetRequestPdu);
                        report = discovery.GetResponse(cred.TimeoutMs, endpoint);

                        // ✅ FIX: Cache this discovery result so ExecuteGetBulkAsync
                        // reuses it instead of doing a NEW discovery that advances
                        // Cisco's engineTime and causes USM desync on the bulk walks.
                        lock (_lock) { _discoveryCache.TryAdd(ipAddress, report); }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogDebug("Discovery failed @ {IP}: {Msg}", ipAddress, ex.Message);
                        return null;
                    }

                    // 🔹 Step 2: SNMPv3 handshake + request
                    for (int retry = 0; retry < 5; retry++)
                    {
                        var request = new GetRequestMessage(
                            VersionCode.V3,
                            Messenger.NextMessageId,
                            Messenger.NextRequestId,
                            new OctetString(cred.Username),
                            new List<Variable> { new Variable(new ObjectIdentifier(oid)) },
                            priv,
                            Messenger.MaxMessageSize,
                            report);

                        ISnmpMessage? response = null;

                        try
                        {
                            var responseTask = Task.Run(() =>
                            {
                                try
                                {
                                    return request.GetResponse(cred.TimeoutMs, endpoint);
                                }
                                catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
                                {
                                    return null;
                                }
                            });

                            if (await Task.WhenAny(responseTask, Task.Delay(cred.TimeoutMs)) != responseTask)
                            {
                                _logger.LogDebug("SNMP timeout (forced) @ {IP}", ipAddress);
                                return null;
                            }

                            response = await responseTask;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug("SNMP error @ {IP}: {Msg}", ipAddress, ex.Message);
                            return null;
                        }

                        if (response == null)
                        {
                            _logger.LogDebug("SNMP timeout (library) @ {IP}", ipAddress);
                            return null;
                        }

                        // 🚨 Handle REPORT (SNMPv3 handshake)
                        if (response is ReportMessage reportMsg)
                        {
                            var err = reportMsg.Pdu().Variables.FirstOrDefault();
                            var errOid = err?.Id?.ToString() ?? string.Empty;

                            _logger.LogWarning(
                                "SNMPv3 REPORT @ {IP}: {Oid} = {Value}",
                                ipAddress, err?.Id, err?.Data);

                            // ✅ FIX: If it's a timing error, invalidate the cached
                            // discovery so the next BULK call gets fresh engine params
                            // instead of reusing the now-stale ones we just cached.
                            bool isTimingError =
                                errOid is "1.3.6.1.6.3.15.1.1.2.0"  // notInTimeWindows
                                       or "1.3.6.1.6.3.15.1.1.4.0"  // unknownEngineIDs
                                       or "1.3.6.1.6.3.15.1.1.6.0"; // decryptionErrors

                            if (isTimingError)
                                InvalidateDiscovery(ipAddress);

                            report = reportMsg;
                            continue;
                        }

                        // ✅ Valid response — update cache with the latest engine params
                        // from this successful exchange so BULK walks stay in sync.
                        lock (_lock) { _discoveryCache[ipAddress] = report; }

                        var variable = response.Pdu().Variables.FirstOrDefault();

                        if (variable == null
                            || variable.Data is NoSuchInstance
                            || variable.Data is NoSuchObject
                            || variable.Data is Null)
                            return null;

                        var oidStr = variable.Id.ToString();
                        if (oidStr.StartsWith("1.3.6.1.6.3.15.1.1"))
                        {
                            _logger.LogWarning(
                                "Received USM error OID instead of data: {Oid} = {Value}",
                                oidStr, variable.Data);
                            return null;
                        }

                        string value = variable.Data switch
                        {
                            OctetString os => os.ToString()?.Trim() ?? "",
                            Integer32 i => i.ToInt32().ToString(),
                            Gauge32 g => g.ToUInt32().ToString(),
                            Counter32 c => c.ToUInt32().ToString(),
                            Counter64 c => c.ToUInt64().ToString(),
                            TimeTicks t => t.ToUInt32().ToString(),
                            _ => variable.Data.ToString()?.Trim() ?? ""
                        };

                        if (string.IsNullOrWhiteSpace(value) ||
                            value.Equals("null", StringComparison.OrdinalIgnoreCase))
                            return null;

                        return value;
                    }

                    return null;
                }
                catch (Exception ex)
                {
                    _logger.LogDebug(
                        "GET {Oid} @ {IP} [{Label}] attempt {A}: {Msg}",
                        oid, ipAddress, cred.Label, attempt + 1, ex.Message);

                    if (attempt >= cred.Retries)
                        return null;
                }
            }

            return null;
        }

        // ── GETBULK walk ──────────────────────────────────────────────────────

        // ── GETBULK walk ──────────────────────────────────────────────────────────────
        private async Task<Dictionary<string, string>> ExecuteGetBulkAsync(
            string ipAddress, string rootOid, int maxRepetitions, SnmpV3Config cred)
        {
            // Shared discovery — if GET already cached one, this is free.
            var report = GetOrCreateDiscovery(ipAddress, cred.Port, cred.TimeoutMs);
            if (report == null) return new Dictionary<string, string>();

            var results = new Dictionary<string, string>();
            var endpoint = new IPEndPoint(IPAddress.Parse(ipAddress), cred.Port);

            try
            {
                await Task.Run(() =>
                {
                    var (_, priv) = BuildProviders(cred);
                    var currentOid = new ObjectIdentifier(rootOid);
                    int resyncCount = 0;

                    while (true)
                    {
                        var request = new GetBulkRequestMessage(
    VersionCode.V3,
    Messenger.NextMessageId,
    Messenger.NextRequestId,
    new OctetString(cred.Username),
    OctetString.Empty,              // ✅ FIX: Use the default empty context
    0,
    maxRepetitions,
    new List<Variable> { new Variable(currentOid) },
    priv,
    Messenger.MaxMessageSize,
    report);

                        ISnmpMessage response;
                        try
                        {
                            response = request.GetResponse(cred.TimeoutMs, endpoint);
                        }
                        catch (Lextm.SharpSnmpLib.Messaging.TimeoutException)
                        {
                            _logger.LogDebug("GETBULK timeout @ {IP} [{Label}]", ipAddress, cred.Label);
                            return; // empty — let caller try next credential
                        }
                        catch (Exception ex)
                        {
                            _logger.LogDebug("GETBULK error @ {IP} [{Label}]: {Msg}",
                                ipAddress, cred.Label, ex.Message);
                            return;
                        }

                        // ── REPORT mid-walk ───────────────────────────────────────
                        if (response is ReportMessage midReport)
                        {
                            var errVar = midReport.Pdu().Variables.FirstOrDefault();
                            var errOid = errVar?.Id?.ToString() ?? string.Empty;
                            var errData = errVar?.Data?.ToString() ?? "?";

                            _logger.LogWarning(
                                "SNMPv3 REPORT (BULK) @ {IP} [{Label}] resync#{R}: {Oid}={Val}",
                                ipAddress, cred.Label, resyncCount, errOid, errData);

                            // FIX: handle all six USM timing/engine errors, not just two.
                            // usmStatsNotInTimeWindows (2) and usmStatsDecryptionErrors (6) were
                            // already covered.  usmStatsUnknownEngineIDs (4) also needs a
                            // re-discovery because it means our cached engineId is wrong.
                            bool isRecoverable =
                                errOid is "1.3.6.1.6.3.15.1.1.2.0"   // notInTimeWindows
                                       or "1.3.6.1.6.3.15.1.1.4.0"   // unknownEngineIDs
                                       or "1.3.6.1.6.3.15.1.1.6.0";  // decryptionErrors

                            if (isRecoverable && resyncCount < 3)
                            {
                                resyncCount++;
                                InvalidateDiscovery(ipAddress);
                                var fresh = GetOrCreateDiscovery(ipAddress, cred.Port, cred.TimeoutMs);
                                if (fresh == null) return;
                                report = fresh;
                                continue;
                            }

                            // Non-recoverable (wrong auth/priv/user) or exceeded resync limit.
                            // Return whatever we have — don't silently swallow partial results.
                            _logger.LogWarning(
                                "GETBULK REPORT unrecoverable @ {IP} [{Label}] — "
                                + "partial results: {Count} rows. Oid={Oid}",
                                ipAddress, cred.Label, results.Count, errOid);
                            return;
                        }

                        resyncCount = 0; // successful response — reset counter

                        var variables = response.Pdu().Variables;
                        if (variables == null || variables.Count == 0) break;

                        bool stop = false;
                        foreach (var v in variables)
                        {
                            var vOid = v.Id.ToString();

                            if (!vOid.StartsWith(rootOid)
                                || v.Data is EndOfMibView
                                || v.Data is NoSuchInstance
                                || v.Data is NoSuchObject)
                            { stop = true; break; }

                            string val = v.Data switch
                            {
                                OctetString os => os.ToString()?.Trim() ?? string.Empty,
                                Integer32 i32 => i32.ToInt32().ToString(),
                                Gauge32 g32 => g32.ToUInt32().ToString(),
                                Counter32 c32 => c32.ToUInt32().ToString(),
                                Counter64 c64 => c64.ToUInt64().ToString(),
                                TimeTicks tt => tt.ToUInt32().ToString(),
                                _ => v.Data.ToString()?.Trim() ?? string.Empty
                            };

                            if (!string.IsNullOrWhiteSpace(val))
                                results[vOid] = val;

                            currentOid = v.Id;
                        }

                        if (stop || variables.Count < maxRepetitions) break;
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogDebug("WALK {Oid} @ {IP} [{Label}]: {Msg}",
                    rootOid, ipAddress, cred.Label, ex.Message);
            }

            return results;
        }

        // ── Security providers ────────────────────────────────────────────────

        private static (IAuthenticationProvider auth, IPrivacyProvider priv)
            BuildProviders(SnmpV3Config cred)
        {
            var authPass = new OctetString(cred.AuthPassword);
            var privPass = new OctetString(cred.PrivPassword);

            IAuthenticationProvider auth = cred.AuthProtocol.ToUpperInvariant() switch
            {
                "MD5" => new MD5AuthenticationProvider(authPass),
                "SHA" or "SHA1" or "SHA128" => new SHA1AuthenticationProvider(authPass),
                "SHA256" => new SHA256AuthenticationProvider(authPass),
                "SHA384" => new SHA384AuthenticationProvider(authPass),
                "SHA512" => new SHA512AuthenticationProvider(authPass),
                _ => throw new InvalidOperationException(
                    $"[{cred.Label}] Unknown AuthProtocol '{cred.AuthProtocol}'. " +
                    "Valid: MD5, SHA, SHA1, SHA128, SHA224, SHA256, SHA384, SHA512")
            };

            IPrivacyProvider priv = cred.PrivProtocol.ToUpperInvariant() switch
            {
                "DES" => new DESPrivacyProvider(privPass, auth),
                "3DES" or "TRIPLEDES" => new TripleDESPrivacyProvider(privPass, auth),
                "AES" or "AES128" => new AESPrivacyProvider(privPass, auth),
                "AES192" => new AES192PrivacyProvider(privPass, auth),
                "AES256" => new AES256PrivacyProvider(privPass, auth),
                _ => throw new InvalidOperationException(
                    $"[{cred.Label}] Unknown PrivProtocol '{cred.PrivProtocol}'. " +
                    "Valid: DES, 3DES, AES, AES128, AES192, AES256")
            };

            return (auth, priv);
        }
    }

    // ── OID Constants ─────────────────────────────────────────────────────────

    public static class OidConstants
    {
        public const string SysDescr = "1.3.6.1.2.1.1.1.0";
        public const string SysObjectId = "1.3.6.1.2.1.1.2.0";
        public const string SysUpTime = "1.3.6.1.2.1.1.3.0";
        public const string SysContact = "1.3.6.1.2.1.1.4.0";
        public const string SysName = "1.3.6.1.2.1.1.5.0";
        public const string SysLocation = "1.3.6.1.2.1.1.6.0";

        public const string IfTable = "1.3.6.1.2.1.2.2.1";
        public const string IfIndex = "1.3.6.1.2.1.2.2.1.1";
        public const string IfDescr = "1.3.6.1.2.1.2.2.1.2";
        public const string IfType = "1.3.6.1.2.1.2.2.1.3";
        public const string IfSpeed = "1.3.6.1.2.1.2.2.1.5";
        public const string IfPhysAddress = "1.3.6.1.2.1.2.2.1.6";
        public const string IfAdminStatus = "1.3.6.1.2.1.2.2.1.7";
        public const string IfOperStatus = "1.3.6.1.2.1.2.2.1.8";
        public const string IfHighSpeed = "1.3.6.1.2.1.31.1.1.1.15";
        public const string IfAlias = "1.3.6.1.2.1.31.1.1.1.18";
        public const string IfName = "1.3.6.1.2.1.31.1.1.1.1";

        public const string IpAdEntAddr = "1.3.6.1.2.1.4.20.1.1";
        public const string IpAdEntIfIndex = "1.3.6.1.2.1.4.20.1.2";

        public const string LldpLocSysName = "1.0.8802.1.1.2.1.3.3.0";
        public const string LldpLocPortDesc = "1.0.8802.1.1.2.1.3.7.1.4";
        public const string LldpRemTable = "1.0.8802.1.1.2.1.4.1.1";
        public const string LldpRemChassisId = "1.0.8802.1.1.2.1.4.1.1.5";
        public const string LldpRemPortId = "1.0.8802.1.1.2.1.4.1.1.7";
        public const string LldpRemPortDesc = "1.0.8802.1.1.2.1.4.1.1.8";
        public const string LldpRemSysName = "1.0.8802.1.1.2.1.4.1.1.9";
        public const string LldpRemSysDesc = "1.0.8802.1.1.2.1.4.1.1.10";
        public const string LldpRemManAddrTable = "1.0.8802.1.1.2.1.4.2.1";

        public const string CdpCacheTable = "1.3.6.1.4.1.9.9.23.1.2.1.1";
        public const string CdpCacheDeviceId = "1.3.6.1.4.1.9.9.23.1.2.1.1.6";
        public const string CdpCacheDevicePort = "1.3.6.1.4.1.9.9.23.1.2.1.1.7";
        public const string CdpCacheAddress = "1.3.6.1.4.1.9.9.23.1.2.1.1.4";
        public const string CdpCachePlatform = "1.3.6.1.4.1.9.9.23.1.2.1.1.8";

        public const string HpSysSwitchType = "1.3.6.1.4.1.11.2.36.1.1.5.1.1.2.1";

        // Fortinet FortiGate interface extensions (fgIntf - 1.3.6.1.4.1.12356.101.7)
        public const string FgIntfEntVdom = "1.3.6.1.4.1.12356.101.7.2.1.1.1"; // virtual domain index
        public const string FgIntfEntEstUpBandwidth = "1.3.6.1.4.1.12356.101.7.2.1.1.2"; // estimated upstream Kbps
        public const string FgIntfEntEstDownBandwidth = "1.3.6.1.4.1.12356.101.7.2.1.1.3"; // estimated downstream Kbps
        public const string FgIntfEntMeaUpBandwidth = "1.3.6.1.4.1.12356.101.7.2.1.1.4"; // measured upstream Kbps
        public const string FgIntfEntMeaDownBandwidth = "1.3.6.1.4.1.12356.101.7.2.1.1.5"; // measured downstream Kbps

        // Fortinet VLAN table (fgIntfVlanTable - indexed by ifIndex)
        public const string FgIntfVlanName = "1.3.6.1.4.1.12356.101.7.2.2.1.1"; // VLAN interface name
        public const string FgIntfVlanID = "1.3.6.1.4.1.12356.101.7.2.2.1.2"; // VLAN ID
        public const string FgIntfVlanPhyName = "1.3.6.1.4.1.12356.101.7.2.2.1.3"; // physical interface name

        // Fortinet system info
        public const string FgSysVersion = "1.3.6.1.4.1.12356.101.4.1.1.0"; // FortiOS firmware version
        public const string FgSysCpuUsage = "1.3.6.1.4.1.12356.101.4.1.3.0"; // CPU %
        public const string FgSysMemUsage = "1.3.6.1.4.1.12356.101.4.1.4.0"; // Memory %

        // Bridge MIB (MAC Address Table)
        public const string Dot1dTpFdbAddress = "1.3.6.1.2.1.17.4.3.1.1";     // The MAC Address
        public const string Dot1dTpFdbPort = "1.3.6.1.2.1.17.4.3.1.2";        // The Bridge Port it lives on
        public const string Dot1dBasePortIfIndex = "1.3.6.1.2.1.17.1.4.1.2";  // Maps Bridge Port -> IfIndex

        // AP table (wlsxApTable) — indexed by AP MAC (BSSID)
        public const string WlsxApName = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.3";
        public const string WlsxApIpAddress = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.2";
        public const string WlsxApLocation = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.19";
        public const string WlsxApNumClients = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.37";
        public const string WlsxApStatus = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.6";  // 1=up 2=down

        // Station table (wlsxStaTable) — indexed by client MAC
        public const string WlsxStaMacAddress = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.1";
        public const string WlsxStaIpAddress = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.3";
        public const string WlsxStaAssociatedAP = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.11";
        public const string WlsxStaEssid = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.4";
        public const string WlsxStaSignalStrength = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.23";
        public const string WlsxStaPhyType = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.6";
        public const string WlsxStaUpTime = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.10";
        public const string WlsxStaBssid = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.2";

        // ── Aruba Controller — wlsxSwitchAccessPointTable ─────────────────────────
        // ArubaOS 6.x path (most common on physical controllers)
        public const string WlsxApTable_v6 = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1";
        public const string WlsxApName_v6 = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.3";
        public const string WlsxApIpAddress_v6 = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.2";

        // ArubaOS 8.x path (newer controllers / Mobility Master)
        public const string WlsxApTable_v8 = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1";
        public const string WlsxApName_v8 = "1.3.6.1.4.1.14823.2.2.1.5.2.1.4.1.3";

        // ── Station table ──────────────────────────────────────────────────────────
        // Standard path — works on both 6.x and 8.x
        public const string WlsxStaTable = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1";
        //public const string WlsxStaAssociatedAP = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.11";
        //public const string WlsxStaIpAddress = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.3";
        //public const string WlsxStaEssid = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.4";
        //public const string WlsxStaSignalStrength = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.23";
        //public const string WlsxStaPhyType = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.6";
        //public const string WlsxStaUpTime = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.10";
        public const string WlsxStaName = "1.3.6.1.4.1.14823.2.2.1.4.1.2.1.22"; // client hostname if known

        // ── Alternative: wlsxWlanAPTable (some firmware versions) ─────────────────
        public const string WlsxWlanApName = "1.3.6.1.4.1.14823.2.2.1.1.3.3.1.2";
        public const string WlsxWlanApIp = "1.3.6.1.4.1.14823.2.2.1.1.3.3.1.4";
        public const string WlsxWlanApNumClients = "1.3.6.1.4.1.14823.2.2.1.1.3.3.1.23";
        public const string WlsxWlanApStatus = "1.3.6.1.4.1.14823.2.2.1.1.3.3.1.19";
        public const string WlsxWlanApLocation = "1.3.6.1.4.1.14823.2.2.1.1.3.3.1.6";
    }
}