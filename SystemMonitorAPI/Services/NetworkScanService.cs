using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.NetworkInformation;
using System.Text.RegularExpressions;
using SystemMonitorAPI.Configuration;
using SystemMonitorAPI.Model;
using SystemMonitorAPI.Models;

namespace SystemMonitorAPI.Services
{
    public interface INetworkScanService
    {
        Task<ScanResult> ScanAllPoolsAsync(CancellationToken ct = default);
        Task<ScanResult> ScanPoolAsync(string poolName, CancellationToken ct = default);
        Task<ScanResult> ScanSingleIpAsync(string ipAddress, string? poolName = null, CancellationToken ct = default);
        Task<List<EndpointDto>> GetEndpointsAsync(int? switchId = null, CancellationToken ct = default);
    }

    public class NetworkScanService : INetworkScanService
    {
        private readonly ISnmpV3Service _snmp;
        private readonly IDbContextFactory<SystemMonitorContext> _dbFactory;
        private readonly NetworkScanConfig _cfg;
        private readonly ILogger<NetworkScanService> _logger;

        public NetworkScanService(
            ISnmpV3Service snmp,
            IDbContextFactory<SystemMonitorContext> dbFactory,
            IOptions<NetworkScanConfig> config,
            ILogger<NetworkScanService> logger)
        {
            _snmp = snmp;
            _dbFactory = dbFactory;
            _cfg = config.Value;
            _logger = logger;
        }

        // ── Entry points ──────────────────────────────────────────────────────

        public async Task<ScanResult> ScanAllPoolsAsync(CancellationToken ct = default)
        {
            var result = new ScanResult();

            // Build a de-duplicated master IP list across ALL enabled pools.
            // Each IP is tried with its pool's credential first, then others as fallback.
            // This avoids scanning the same IP multiple times when pools overlap.
            var allIps = _cfg.IpPools
                .Where(p => p.Enabled)
                .SelectMany(p => ExpandPool(p).Select(ip => (ip, pool: p)))
                .GroupBy(x => x.ip)                          // de-duplicate IPs
                .Select(g => g.First())                       // keep first pool for each IP
                .ToList();

            _logger.LogInformation(
                "Full scan: {PoolCount} pools, {IpCount} unique IPs",
                _cfg.IpPools.Count(p => p.Enabled), allIps.Count);

            var sem = new SemaphoreSlim(_cfg.MaxParallelScans);
            var tasks = allIps.Select(async x =>
            {
                await sem.WaitAsync(ct);
                try
                {
                    ct.ThrowIfCancellationRequested();
                    var r = await ScanSingleIpAsync(x.ip, x.pool.Name, ct);
                    result.Merge(r);
                }
                finally { sem.Release(); }
            });

            await Task.WhenAll(tasks);
            await BuildTopologyAsync(ct);

            _logger.LogInformation(
                "Full scan complete — {Found} switches found", result.SwitchesFound);
            return result;
        }

        public async Task<ScanResult> ScanPoolAsync(string poolName, CancellationToken ct = default)
        {
            var pool = _cfg.IpPools.FirstOrDefault(p => p.Name == poolName);
            if (pool == null) throw new ArgumentException($"Pool '{poolName}' not found in config.");

            var ips = ExpandPool(pool);
            _logger.LogInformation("Scanning pool '{Pool}': {Count} IPs", poolName, ips.Count);

            var result = new ScanResult { PoolName = poolName };
            var sem = new SemaphoreSlim(_cfg.MaxParallelScans);

            var tasks = ips.Select(async ip =>
            {
                await sem.WaitAsync(ct);
                try
                {
                    ct.ThrowIfCancellationRequested();
                    result.Merge(await ScanSingleIpAsync(ip, pool.Name, ct));
                }
                finally { sem.Release(); }
            });

            await Task.WhenAll(tasks);
            _logger.LogInformation(
                "Pool '{Pool}' complete: {Found} switches found", poolName, result.SwitchesFound);
            return result;
        }

        public async Task<ScanResult> ScanSingleIpAsync(
            string ipAddress, string? poolName = null, CancellationToken ct = default)
        {
            var result = new ScanResult();
            _logger.LogDebug("Probing {IP} (pool hint: {Pool})", ipAddress, poolName ?? "auto");

            // Step 1: Quick ping
            if (!await PingAsync(ipAddress))
            {
                await MarkUnreachableAsync(ipAddress);
                return result;
            }

            // Step 2: SNMP sysDescr — pool name tells service which credential to try first
            var sysDescr = await _snmp.GetAsync(ipAddress, OidConstants.SysDescr, poolName);
            if (sysDescr == null)
            {
                _logger.LogDebug("No SNMP response from {IP}", ipAddress);
                await MarkUnreachableAsync(ipAddress);
                return result;
            }

            result.SwitchesFound++;

            // ── FIX 1: Resolve the EFFECTIVE pool name from the credential that worked ──
            // When two pools share the same IP range (e.g. Aruba_Switches and
            // Cisco_Switches both covering 192.168.129.51-123), the first pool to
            // scan caches a credential for that IP.  We must override the pool name
            // with whichever pool's credential actually responded so that Cisco
            // switches are not mis-labeled as "Aruba_Switches" and vice-versa.
            var effectivePool = ResolveEffectivePool(ipAddress, poolName);
            _logger.LogDebug("{IP} → credential matched pool '{Pool}'", ipAddress, effectivePool);

            // Step 3: System OIDs — credential already cached, these are fast
            var sysName = await _snmp.GetAsync(ipAddress, OidConstants.SysName, effectivePool) ?? ipAddress;
            var sysLocation = await _snmp.GetAsync(ipAddress, OidConstants.SysLocation, effectivePool) ?? string.Empty;
            var sysContact = await _snmp.GetAsync(ipAddress, OidConstants.SysContact, effectivePool) ?? string.Empty;
            var sysUpTime = await _snmp.GetAsync(ipAddress, OidConstants.SysUpTime, effectivePool) ?? "0";

            var (vendor, model, layer) = DetectVendorAndModel(sysDescr, ipAddress);
            _logger.LogInformation(
                "Found {Vendor} {Model} ({Layer}) at {IP} — pool: {Pool}",
                vendor, model, layer, ipAddress, effectivePool);

            try
            {
                await using var db = await _dbFactory.CreateDbContextAsync(ct);

                var sw = await db.Switches
                             .Include(s => s.Ports)
                             .FirstOrDefaultAsync(s => s.IpAddress == ipAddress, ct)
                         ?? new SmmSwitch { IpAddress = ipAddress, FirstDiscovered = DateTime.Now };

                sw.Hostname = SanitizeName(sysName);
                sw.SysDescr = sysDescr.Length > 1024 ? sysDescr[..1024] : sysDescr;
                sw.Vendor = vendor;
                sw.Model = model;
                sw.SwitchLayer = layer;
                sw.Location = sysLocation;
                sw.Contact = sysContact;
                sw.UptimeSeconds = ParseUptime(sysUpTime);
                sw.IsReachable = true;
                sw.LastScanDate = DateTime.Now;
                sw.IsActive = true;
                sw.PoolName = effectivePool;  // always use the credential-resolved pool

                if (sw.SwitchId == 0) db.Switches.Add(sw);
                await db.SaveChangesAsync(ct);

                if (vendor == "Fortinet")
                    await ScanFortinetInterfacesAsync(sw, db, effectivePool, ct);
                else
                    await ScanInterfacesAsync(sw, db, effectivePool, ct);

               // await ScanMacAddressTableAsync(sw, db, effectivePool, ct);

                // Replace the protocol dispatch block in ScanSingleIpAsync:

                var neighborProtocol = await DetectNeighborProtocolAsync(sw.IpAddress, effectivePool);

                if (neighborProtocol == "LLDP" || neighborProtocol == "BOTH")
                {
                    _logger.LogDebug("Running LLDP scan for {IP}", sw.IpAddress);
                    await ScanLldpNeighborsAsync(sw, db, effectivePool, ct);
                }

                if (neighborProtocol == "CDP" || neighborProtocol == "BOTH")
                {
                    _logger.LogDebug("Running CDP scan for {IP}", sw.IpAddress);
                    await ScanCdpNeighborsAsync(sw, db, effectivePool, ct);
                }

                if (neighborProtocol == null)
                {
                    _logger.LogDebug("No neighbor protocol available for {IP}", sw.IpAddress);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scan data for {IP}", ipAddress);
            }
            await BuildTopologyAsync(ct);
            return result;
        }

        private async Task<string?> DetectNeighborProtocolAsync(string ip, string? poolName)
        {
            try
            {
                var cdp = await _snmp.GetBulkAsync(ip, OidConstants.CdpCacheDeviceId,
                               maxRepetitions: 3, poolName: poolName);
                var lldp = await _snmp.GetBulkAsync(ip, OidConstants.LldpRemSysName,
                               maxRepetitions: 3, poolName: poolName);

                // Return "BOTH" when the switch supports both protocols.
                // Caller will run LLDP first (better hostnames), then CDP fills
                // in any ports LLDP missed.
                if (cdp.Count > 0 && lldp.Count > 0) return "BOTH";
                if (lldp.Count > 0) return "LLDP";
                if (cdp.Count > 0) return "CDP";
            }
            catch (Exception ex)
            {
                _logger.LogDebug("Neighbor protocol detection failed for {IP}: {Msg}", ip, ex.Message);
            }

            return null;
        }

        // ── FIX 1 IMPLEMENTATION ──────────────────────────────────────────────
        // After GetAsync succeeds, GetCachedCredentialLabel tells us WHICH
        // credential label worked.  We then find the pool whose SnmpCredentialLabel
        // matches — that is the "true" pool for this switch.
        // Falls back to the original poolName if no match is found.

        private string? ResolveEffectivePool(string ipAddress, string? originalPoolName)
        {
            var workedLabel = _snmp.GetCachedCredentialLabel(ipAddress);
            if (string.IsNullOrEmpty(workedLabel)) return originalPoolName;

            // Find the pool whose SnmpCredentialLabel matches the credential that worked
            var matchedPool = _cfg.IpPools.FirstOrDefault(p =>
                string.Equals(p.SnmpCredentialLabel, workedLabel, StringComparison.OrdinalIgnoreCase));

            return matchedPool?.Name ?? originalPoolName;
        }
        private async Task ScanMacAddressTableAsync(
    SmmSwitch sw, SystemMonitorContext db, string? poolName, CancellationToken ct)
        {
            _logger.LogDebug("Scanning MAC Address table for {IP}", sw.IpAddress);

            // 1. Get MACs to Bridge Ports
            var fdbPorts = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.Dot1dTpFdbPort, maxRepetitions: 20, poolName: poolName);

            // 2. Get Bridge Ports to IfIndexes
            var basePortIfIndexes = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.Dot1dBasePortIfIndex, maxRepetitions: 20, poolName: poolName);

            if (!fdbPorts.Any() || !basePortIfIndexes.Any())
            {
                _logger.LogDebug("No Bridge MIB data returned for {IP}", sw.IpAddress);
                return;
            }

            // Build a lookup dictionary: BridgePort ID -> IfIndex
            var bridgeToIfIndex = new Dictionary<string, int>();
            foreach (var kv in basePortIfIndexes)
            {
                var bridgePortStr = kv.Key.Split('.').Last();
                if (int.TryParse(kv.Value, out int ifIndex))
                {
                    bridgeToIfIndex[bridgePortStr] = ifIndex;
                }
            }

            // Parse the FDB table
            foreach (var kv in fdbPorts)
            {
                // The OID suffix is the MAC address in decimal format (e.g., .108.3.181.242.106.3)
                var oidSuffix = kv.Key.Replace($"{OidConstants.Dot1dTpFdbPort}.", "");
                var macBytes = oidSuffix.Split('.').Select(b => byte.Parse(b)).ToArray();
                var macAddress = string.Join(":", macBytes.Select(b => b.ToString("X2")));

                var bridgePort = kv.Value;

                // Correlate Bridge Port -> IfIndex
                if (bridgeToIfIndex.TryGetValue(bridgePort, out int ifIndex))
                {
                    // Find the physical port in our database model
                    var localPort = sw.Ports.FirstOrDefault(p => p.IfIndex == ifIndex);

                    if (localPort != null)
                    {
                        // We now know this MAC address is connected to this physical port!
                        // We can save this as an endpoint.

                        // Skip if this MAC is already tracked via LLDP/CDP
                        bool alreadyExists = await db.SwitchNeighbors.AnyAsync(n =>
                            n.LocalSwitchId == sw.SwitchId &&
                            n.RemoteChassisId == macAddress, ct);

                        if (!alreadyExists)
                        {
                            db.SwitchNeighbors.Add(new SmmSwitchNeighbor
                            {
                                LocalSwitchId = sw.SwitchId,
                                LocalPortId = localPort.PortId,
                                LocalPortName = localPort.PortName,
                                RemoteChassisId = macAddress,
                                Protocol = "FDB",       // Indicate this was found via MAC table
                                IsEndpoint = true,      // It's an endpoint system
                                LastSeen = DateTime.Now
                            });
                        }
                    }
                }
            }

            await db.SaveChangesAsync(ct);
        }

        // ── Interfaces ────────────────────────────────────────────────────────

        private async Task ScanInterfacesAsync(
            SmmSwitch sw, SystemMonitorContext db, string? poolName, CancellationToken ct)
        {
            // FIX 2: Sequential walks to the same switch instead of 7 parallel ones.
            // Running 7 simultaneous SNMPv3 GETBULK requests to the same agent
            // causes usmStatsDecryptionErrors because each call does its own
            // engine-time discovery, and they race against each other's timing window.
            // Sequential calls reuse the cached credential and avoid this entirely.
            // Update your calls in ScanFortinetInterfacesAsync to include maxRepetitions: 10
            var descrs = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfDescr, maxRepetitions: 10, poolName: poolName);
            var opers = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfOperStatus, maxRepetitions: 10, poolName: poolName);
            var admins = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfAdminStatus, maxRepetitions: 10, poolName: poolName);
            var speeds = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfHighSpeed, maxRepetitions: 10, poolName: poolName);
            var types = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfType, maxRepetitions: 10, poolName: poolName);
            //var descrs = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfName, poolName: poolName);
            //var types = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfType, poolName: poolName);
            var macs = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfPhysAddress, poolName: poolName);
            //var speeds = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfHighSpeed, poolName: poolName);
            //var admins = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfAdminStatus, poolName: poolName);
            //var opers = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfOperStatus, poolName: poolName);
            var aliases = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfAlias, poolName: poolName);

            foreach (var kv in descrs)
            {
                var ifIndexStr = kv.Key.Split('.').Last();
                if (!int.TryParse(ifIndexStr, out int ifIndex)) continue;

                // Skip loopback (type 24)
                var typeSuffix = $"{OidConstants.IfType}.{ifIndex}";
                // With this:
                if (types.TryGetValue(typeSuffix, out var typeStr))
                {
                    if (int.TryParse(typeStr, out int ifTypeVal))
                    {
                        // Skip: 24=loopback, 131=tunnel, 166=mpls, 160=ieee80216WMAN
                        // Allow everything else including Fortinet's physical/vlan/aggregate ports
                        if (ifTypeVal == 24 || ifTypeVal == 131 || ifTypeVal == 166)
                            continue;
                    }
                }

                var port = sw.Ports.FirstOrDefault(p => p.IfIndex == ifIndex)
                           ?? new SmmSwitchPort { SwitchId = sw.SwitchId, IfIndex = ifIndex };

                port.PortName = kv.Value;
                port.LastUpdated = DateTime.Now;

                if (macs.TryGetValue($"{OidConstants.IfPhysAddress}.{ifIndex}", out var mac))
                    port.MacAddress = FormatMac(mac);

                if (speeds.TryGetValue($"{OidConstants.IfHighSpeed}.{ifIndex}", out var spd)
                    && long.TryParse(spd, out long mbps))
                    port.SpeedMbps = mbps;

                if (admins.TryGetValue($"{OidConstants.IfAdminStatus}.{ifIndex}", out var adm)
                    && int.TryParse(adm, out int admInt))
                    port.AdminStatus = admInt;

                if (opers.TryGetValue($"{OidConstants.IfOperStatus}.{ifIndex}", out var op)
                    && int.TryParse(op, out int opInt))
                    port.OperStatus = opInt;

                if (aliases.TryGetValue($"{OidConstants.IfAlias}.{ifIndex}", out var alias))
                    port.PortAlias = alias;

                if (typeStr != null && int.TryParse(typeStr, out int typeInt))
                    port.IfType = typeInt;

                if (port.PortId == 0)
                    sw.Ports.Add(port);
            }

            await db.SaveChangesAsync(ct);
        }

        // ── LLDP ──────────────────────────────────────────────────────────────

        private async Task ScanLldpNeighborsAsync(
     SmmSwitch sw,
     SystemMonitorContext db,
     string? poolName,
     CancellationToken ct)
        {
            // Fetch LLDP tables
            var sysNames = await _snmp.GetBulkAsync(
                sw.IpAddress!,
                OidConstants.LldpRemSysName,
                maxRepetitions: 15,
                poolName: poolName);

            var portIds = await _snmp.GetBulkAsync(
                sw.IpAddress!,
                OidConstants.LldpRemPortId,
                maxRepetitions: 15,
                poolName: poolName);

            var portDescs = await _snmp.GetBulkAsync(
                sw.IpAddress!,
                OidConstants.LldpRemPortDesc,
                maxRepetitions: 15,
                poolName: poolName);

            var chassisIds = await _snmp.GetBulkAsync(
                sw.IpAddress!,
                OidConstants.LldpRemChassisId,
                maxRepetitions: 15,
                poolName: poolName);

            // IMPORTANT:
            // Some devices do NOT populate lldpRemSysName.
            // So use union of all keys instead of depending only on sysNames.
            var allKeys = sysNames.Keys
                .Union(portIds.Keys)
                .Union(portDescs.Keys)
                .Union(chassisIds.Keys)
                .Distinct()
                .ToList();

            if (!allKeys.Any())
            {
                _logger.LogDebug("No LLDP neighbors found on {IP}", sw.IpAddress);
                return;
            }

            // Remove old LLDP rows for this switch
            var existing = await db.SwitchNeighbors
                .Where(n => n.LocalSwitchId == sw.SwitchId && n.Protocol == "LLDP")
                .ToListAsync(ct);

            db.SwitchNeighbors.RemoveRange(existing);

            foreach (var key in allKeys)
            {
                // OID suffix format:
                // ...timeMark.localPort.remoteIndex
                var parts = key.Split('.');
                if (parts.Length < 3)
                    continue;

                if (!int.TryParse(parts[^2], out int localPortNum))
                    continue;

                var suffix = $"{parts[^3]}.{parts[^2]}.{parts[^1]}";

                var localPort = sw.Ports.FirstOrDefault(p => p.IfIndex == localPortNum);

                sysNames.TryGetValue(key, out var sysName);

                portIds.TryGetValue(
                    $"{OidConstants.LldpRemPortId}.{suffix}",
                    out var remotePortId);

                portDescs.TryGetValue(
                    $"{OidConstants.LldpRemPortDesc}.{suffix}",
                    out var remotePortDesc);

                chassisIds.TryGetValue(
                    $"{OidConstants.LldpRemChassisId}.{suffix}",
                    out var chassisId);

                // Resolve readable remote port
                var remotePort = ResolveLldpPortName(remotePortDesc, remotePortId);

                // IMPORTANT:
                // If SysName blank, fallback to PortId then ChassisId
                var identity =
                    !string.IsNullOrWhiteSpace(sysName) ? sysName.Trim() :
                    !string.IsNullOrWhiteSpace(remotePortId) ? remotePortId.Trim() :
                    !string.IsNullOrWhiteSpace(chassisId) ? FormatMac(chassisId) :
                    null;

                if (string.IsNullOrWhiteSpace(identity))
                    continue;

                _logger.LogDebug(
                    "LLDP {IP} local={LocalPort} remote={Remote} port={RemotePort} mac={Mac}",
                    sw.IpAddress,
                    localPort?.PortName,
                    identity,
                    remotePort,
                    chassisId);

                db.SwitchNeighbors.Add(new SmmSwitchNeighbor
                {
                    LocalSwitchId = sw.SwitchId,
                    LocalPortId = localPort?.PortId,
                    LocalPortName = localPort?.PortName,

                    // Use resolved identity
                    RemoteSysName = identity,

                    RemotePortName = remotePort,
                    RemoteChassisId = !string.IsNullOrWhiteSpace(chassisId)
                        ? FormatMac(chassisId)
                        : null,

                    Protocol = "LLDP",
                    IsEndpoint = IsLldpEndpoint(identity, remotePort),
                    LastSeen = DateTime.Now
                });

                if (localPort != null)
                    localPort.IsUplink = true;
            }

            await db.SaveChangesAsync(ct);
        }
        /// <summary>
        /// Classifies an LLDP neighbor as an endpoint (AP, phone, PC)
        /// vs a managed switch. Switches always have readable port names
        /// like "Gi1/0/1". Endpoints send MACs or blank port IDs.
        /// </summary>
        private static bool IsLldpEndpoint(string? sysName, string? portName)
        {
            // If port resolved to a known switch port format → it's a switch
            if (!string.IsNullOrWhiteSpace(portName) && IsKnownSwitchPortFormat(portName))
                return false;

            // MAC-only port name → endpoint (phone, AP, PC)
            if (portName != null &&
                System.Text.RegularExpressions.Regex.IsMatch(portName,
                    @"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$"))
                return true;

            // Device name hints
            var name = (sysName ?? "").ToUpperInvariant();
            if (name.Contains("-AP") || name.Contains("AP-") || name.Contains("AIR-") ||
                name.Contains("SEP") || name.Contains("CP-") ||
                name.Contains("-PC") || name.Contains("PHONE"))
                return true;

            // Blank/unresolvable port with no switch-like name → treat as endpoint
            if (string.IsNullOrWhiteSpace(portName))
                return true;

            return false;
        }
        // ── LLDP port name resolver ───────────────────────────────────────────────────
        // LldpRemPortDesc is a human-readable string but is blank on many devices.
        // LldpRemPortId contains the actual port identifier but its encoding depends
        // on the LldpPortIdSubtype advertised by the remote device:
        //
        //   Subtype 1 (interfaceAlias)   → readable string  "GigabitEthernet1/0/1"
        //   Subtype 3 (macAddress)       → 6 raw bytes      → format as MAC
        //   Subtype 5 (interfaceName)    → readable string  "gi24", "B11"
        //   Subtype 7 (local)            → readable string or numeric index
        //
        // We can't easily read the subtype OID per-entry during a bulk walk, so we
        // use the same printability heuristic: if the value is readable ASCII that
        // looks like a port name, use it; if it's binary (MAC subtype), format it;
        // prefer PortDesc over PortId when both are present and readable.

        private static string? ResolveLldpPortName(string? portDesc, string? portId)
        {
            // Prefer PortDesc if it's a readable non-empty string
            if (!string.IsNullOrWhiteSpace(portDesc))
            {
                var desc = portDesc.Trim();
                if (desc.All(c => c >= 0x20 && c <= 0x7E) && desc.Length >= 1)
                    return desc;
            }

            if (string.IsNullOrWhiteSpace(portId)) return null;

            var id = portId.Trim();

            // All printable ASCII → use directly (interfaceName or interfaceAlias subtype)
            if (id.All(c => c >= 0x20 && c <= 0x7E))
                return id;

            // Non-printable bytes → MAC address subtype (6 bytes) or binary index
            byte[] bytes;
            try { bytes = System.Text.Encoding.Latin1.GetBytes(id); }
            catch { return null; }

            if (bytes.Length == 6)
                return string.Join(":", bytes.Select(b => b.ToString("X2")));

            // Try extracting any printable ASCII run
            var ascii = System.Text.Encoding.ASCII.GetString(
                bytes.Where(b => b >= 0x20 && b <= 0x7E).ToArray()).Trim();

            return ascii.Length >= 2 ? ascii : null;
        }
        // ── CDP ───────────────────────────────────────────────────────────────

        private async Task ScanCdpNeighborsAsync(
    SmmSwitch sw, SystemMonitorContext db, string? poolName, CancellationToken ct)
        {
            var deviceIds = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.CdpCacheDeviceId, maxRepetitions: 15, poolName: poolName);
            var devicePorts = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.CdpCacheDevicePort, maxRepetitions: 15, poolName: poolName);
            var addresses = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.CdpCacheAddress, maxRepetitions: 15, poolName: poolName);
            if (!deviceIds.Any()) return;

            var existing = await db.SwitchNeighbors
                .Where(n => n.LocalSwitchId == sw.SwitchId && n.Protocol == "CDP")
                .ToListAsync(ct);
            db.SwitchNeighbors.RemoveRange(existing);

            foreach (var kv in deviceIds)
            {
                var parts = kv.Key.Split('.');
                if (parts.Length < 2) continue;

                var ifIndexStr = parts[^2];
                if (!int.TryParse(ifIndexStr, out int ifIndex)) continue;

                var idxSuffix = $"{ifIndexStr}.{parts[^1]}";

                devicePorts.TryGetValue($"{OidConstants.CdpCacheDevicePort}.{idxSuffix}", out var rawPort);
                addresses.TryGetValue($"{OidConstants.CdpCacheAddress}.{idxSuffix}", out var remoteIp);

                var deviceId = DecodeCdpString(kv.Value, isDeviceId: true);
                var remotePort = DecodeCdpString(rawPort ?? "", isDeviceId: false);

                // ── Classify this neighbor ────────────────────────────────────────
                // We want to KEEP:  switch-to-switch links (port = "Gi1/0/1", "48", "gi10")
                // We want to SKIP:  end devices where port is pure unrecoverable binary
                //
                // The old IsNetworkDevicePort() was called AFTER DecodeCdpString()
                // which sometimes still returns non-printable chars — causing the
                // printability check to fail even for valid switch ports.
                //
                // New approach: classify by RAW bytes BEFORE decoding.
                // A port value is "endpoint binary" only when:
                //   - The raw string has non-printable bytes (it's binary-encoded)
                //   - AND no printable ASCII run of 2+ chars can be extracted
                //   - AND it doesn't decode to a known port format
                // Everything else — including pure numbers like "47", "48" — is kept.

                var localPort = sw.Ports.FirstOrDefault(p => p.IfIndex == ifIndex);

                if (IsEndpointOnlyEntry(rawPort, remotePort))
                {
                    _logger.LogDebug(
                        "CDP: skipping endpoint '{Device}' on {IP} local-ifIndex {Idx} " +
                        "(unrecoverable port bytes: '{Raw}')",
                        deviceId, sw.IpAddress, ifIndex, rawPort);
                    continue;
                }

                bool lldpAlreadyPresent = localPort != null && await db.SwitchNeighbors.AnyAsync(n =>
                    n.LocalSwitchId == sw.SwitchId &&
                    n.LocalPortId == localPort.PortId &&
                    n.Protocol == "LLDP", ct);

                if (lldpAlreadyPresent) continue;

                db.SwitchNeighbors.Add(new SmmSwitchNeighbor
                {
                    LocalSwitchId = sw.SwitchId,
                    LocalPortId = localPort?.PortId,
                    LocalPortName = localPort?.PortName,
                    RemoteSysName = deviceId,
                    RemotePortName = string.IsNullOrWhiteSpace(remotePort) ? null : remotePort,
                    RemoteIp = remoteIp,
                    Protocol = "CDP",
                    LastSeen = DateTime.UtcNow
                });

                if (localPort != null)
                    localPort.IsUplink = true;
            }

            await db.SaveChangesAsync(ct);
        }

        // ── Endpoint detection ────────────────────────────────────────────────────────
        // Returns true ONLY when we are certain this is an end-device (PC, phone, AP)
        // and NOT a switch-to-switch link.
        //
        // Decision tree:
        //   1. Raw port is null/empty           → keep (some switches omit port)
        //   2. Raw port is fully printable      → keep always (readable = switch port)
        //   3. Raw port has non-printable bytes (binary):
        //        a. Decoded result is a known switch port format → keep
        //        b. A printable ASCII run of 2+ chars extracted  → keep
        //        c. Nothing readable recovered                   → SKIP (endpoint)
        private static bool IsEndpointOnlyEntry(string? rawPort, string? decodedPort)
        {
            // No port info at all — keep the neighbor, just no port name
            if (string.IsNullOrWhiteSpace(rawPort))
                return false;

            // Fully printable raw value — always a real port name, never skip
            if (rawPort.All(c => c >= 0x20 && c <= 0x7E))
                return false;

            // Raw bytes are non-printable (binary-encoded port field).
            // Check if decoding recovered anything useful.

            // Decoded to a known switch port pattern → keep
            if (!string.IsNullOrWhiteSpace(decodedPort) &&
                decodedPort.All(c => c >= 0x20 && c <= 0x7E) &&
                IsKnownSwitchPortFormat(decodedPort))
                return false;

            // Try to extract any printable run of 2+ chars from the raw bytes
            byte[] bytes;
            try { bytes = System.Text.Encoding.Latin1.GetBytes(rawPort); }
            catch { return true; }

            var printableRun = new string(
                bytes.Where(b => b >= 0x20 && b <= 0x7E)
                     .Select(b => (char)b)
                     .ToArray()).Trim();

            // Got a readable string of 2+ chars → likely a port name, keep it
            if (printableRun.Length >= 2)
                return false;

            // Nothing readable at all → endpoint binary blob → skip
            return true;
        }

        // ── Known switch port format check ───────────────────────────────────────────
        // Only called on already-printable strings.
        // Broader than before: accepts pure numbers (Aruba ports like "47", "48")
        // and slash-separated formats (Cisco "1/0/1", Aruba CX "1/1/1").
        private static bool IsKnownSwitchPortFormat(string p)
        {
            if (string.IsNullOrWhiteSpace(p)) return false;
            p = p.Trim();

            // Pure number 1–999  (Aruba/HP port numbers, CBS gi-only numbers)
            if (System.Text.RegularExpressions.Regex.IsMatch(p, @"^\d{1,3}$"))
                return true;

            // Slash-separated:  1/0/1  1/1  47/1
            if (System.Text.RegularExpressions.Regex.IsMatch(p, @"^\d+(/\d+)+$"))
                return true;

            // Cisco long:  GigabitEthernet…  FastEthernet…  TenGigabitEthernet…
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(GigabitEthernet|FastEthernet|TenGigabitEthernet|" +
                @"FortyGigabitEthernet|HundredGigE|Management)\d",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Cisco/generic short:  Gi1/0/1  Fa0/1  Te1/1  gi10  gi24  eth0
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(Gi|Fa|Te|Fo|Hu|Mg|Et|Po|gi|te|fa|eth)\d",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Aruba letter+number:  A1  B12  C24
            if (System.Text.RegularExpressions.Regex.IsMatch(p, @"^[A-Za-z]\d{1,3}$"))
                return true;

            // Trunk/LAG/VLAN:  trk1  lag1  vlan10
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(trk|lag|vlan|po)\d+$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Juniper:  ge-0/0/1  xe-0/0/1
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(ge|xe|et|fe)-\d+/\d+/\d+",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            return false;
        }

        // ── Endpoint detection ────────────────────────────────────────────────────────
        // Returns true ONLY when we are certain this is an end-device (PC, phone, AP)
        // and NOT a switch-to-switch link.
        //
        // Decision tree:
        //   1. Raw port is null/empty           → keep (some switches omit port)
        //   2. Raw port is fully printable      → keep always (readable = switch port)
        //   3. Raw port has non-printable bytes (binary):
        //        a. Decoded result is a known switch port format → keep
        //        b. A printable ASCII run of 2+ chars extracted  → keep
        //        c. Nothing readable recovered                   → SKIP (endpoint)

        // ── Switch port name detector ─────────────────────────────────────────────────
        // Returns true only if the string looks like a real network device port.
        // All switch vendors use consistent, readable port naming conventions.
        // End devices send binary blobs that never match any of these patterns.
        private static bool IsNetworkDevicePort(string? port)
        {
            if (string.IsNullOrWhiteSpace(port)) return false;

            // Must be fully printable ASCII first
            if (!port.All(c => c >= 0x20 && c <= 0x7E)) return false;

            var p = port.Trim();

            // Cisco full names:   GigabitEthernet1/0/1  FastEthernet0/1
            //                     TenGigabitEthernet1/1  FortyGigabitEthernet1/1
            //                     HundredGigE1/0/1
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(GigabitEthernet|FastEthernet|TenGigabitEthernet|" +
                @"FortyGigabitEthernet|HundredGigE|Management)\d",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Cisco short names:  Gi1/0/1  Fa0/1  Te1/1  Fo1/1  Hu1/1  Mg0
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(Gi|Fa|Te|Fo|Hu|Mg|Et|Po)\d",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Aruba / HP / Procurve:  1  24  A1  B12  trk1  Trk2
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^([A-Z]?\d{1,3}|[Tt]rk\d+)$"))
                return true;

            // Aruba CX / generic:  1/1/1  1/1  lag1  vlan10
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(\d+/\d+(/\d+)?|lag\d+|vlan\d+)$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Juniper:  ge-0/0/1  xe-0/0/1  et-0/0/1
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(ge|xe|et|fe)-\d+/\d+/\d+",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            // Generic numeric-only port (some CBS/SG switches):  gi1  gi24  te1
            if (System.Text.RegularExpressions.Regex.IsMatch(p,
                @"^(gi|te|fa|eth)\d+$",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                return true;

            return false;
        }

        // ── Detect binary garbage ─────────────────────────────────────────────────────
        // A string is "binary garbage" if more than 30% of its characters are
        // outside printable ASCII range. This threshold tolerates the occasional
        // special character in a real hostname while catching binary byte arrays.
        private static bool IsBinaryGarbage(string? s)
        {
            if (string.IsNullOrWhiteSpace(s)) return false;
            int nonPrintable = s.Count(c => c < 0x20 || c > 0x7E);
            return (double)nonPrintable / s.Length > 0.30;
        }

        // ── Infer a readable label for endpoint port identifiers ─────────────────────
        // Endpoints (PCs, phones, APs, printers) advertise their port via CDP as a
        // raw binary interface index — there is no readable port name to show.
        // Instead, derive a meaningful label from what we DO know about the device.
        private static string InferEndpointPortLabel(
            string deviceId, string? platform, string? remoteIp)
        {
            var name = deviceId.ToUpperInvariant();
            var plat = (platform ?? "").ToUpperInvariant();
            var combined = $"{name} {plat}";

            // IP Phone
            if (combined.Contains("PHONE") || combined.Contains("SEP") ||
                combined.Contains("CP-") || plat.Contains("CISCO IP"))
                return "Phone port";

            // Access Point
            if (combined.Contains("-AP") || combined.Contains("AP-") ||
                combined.Contains("AIR-") || plat.Contains("ACCESS POINT") ||
                combined.Contains("WAP"))
                return "AP uplink";

            // PC / Workstation / Laptop
            if (name.Contains("-PC") || name.Contains("PC-") ||
                name.Contains("-WS") || name.Contains("LAPTOP") ||
                name.Contains("DESKTOP"))
                return "PC NIC";

            // Standee / display device
            if (name.Contains("STANDEE") || name.Contains("DISPLAY") ||
                name.Contains("SCREEN"))
                return "Display port";

            // Printer
            if (combined.Contains("PRINTER") || combined.Contains("PRN") ||
                combined.Contains("HP LaserJet", StringComparison.OrdinalIgnoreCase))
                return "Printer port";

            // If we at least have an IP, say so
            if (!string.IsNullOrWhiteSpace(remoteIp))
                return $"Endpoint ({remoteIp})";

            // Generic endpoint fallback
            return "Endpoint port";
        }

        // ── CDP string decoder ────────────────────────────────────────────────────────
        private static string DecodeCdpString(string raw, bool isDeviceId)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;

            bool isPrintable = raw.All(c => c >= 0x20 && c <= 0x7E);
            if (isPrintable) return raw.Trim();

            byte[] bytes;
            try { bytes = System.Text.Encoding.Latin1.GetBytes(raw); }
            catch { return raw; }

            // 6-byte binary → MAC address (common for DeviceId on Cisco endpoints)
            if (isDeviceId && bytes.Length == 6)
                return string.Join(":", bytes.Select(b => b.ToString("X2")));

            // Try extracting printable ASCII run from the bytes
            // (handles cases where a valid string got one bad byte prepended)
            var asciiRun = System.Text.Encoding.ASCII.GetString(
                bytes.Where(b => b >= 0x20 && b <= 0x7E).ToArray()).Trim();

            if (!string.IsNullOrWhiteSpace(asciiRun) && asciiRun.Length >= 2)
                return asciiRun;

            // Final fallback: hex, at least it's readable
            return BitConverter.ToString(bytes).Replace("-", ":");
        }
        // ── CDP DeviceId decoder ──────────────────────────────────────────────────────
        // cdpCacheDeviceId is an OCTET STRING.  Cisco uses it in two ways:
        //
        //   1. Hostname string  → "MEAI-SRV-FF-SW06"
        //      All bytes are printable ASCII (0x20–0x7E).
        //
        //   2. Binary MAC bytes → 6 raw bytes e.g. 0x6C 0x03 0xB5 0xF2 0x6A 0x03
        //      SharpSnmpLib's OctetString.ToString() runs UTF-8 decode on these,
        //      producing garbled output.  We detect this by checking whether ALL
        //      characters are printable ASCII.  If not, re-interpret as hex.
        //
        //   3. MAC-formatted string → "6c:03:b5:f2:6a:03" (some IOS versions)
        //      Already printable — returned as-is.

        private static string DecodeCdpDeviceId(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return raw;

            // If every character is printable ASCII, treat as hostname string.
            if (raw.All(c => c >= 0x20 && c <= 0x7E))
                return raw.Trim();

            // Otherwise the OctetString bytes are non-printable — it's a binary MAC.
            // Re-encode the raw string back to bytes using Latin-1 (ISO-8859-1),
            // which is a 1:1 byte↔char mapping that survives the round-trip through
            // SharpSnmpLib's internal byte[] → string conversion.
            try
            {
                var bytes = System.Text.Encoding.Latin1.GetBytes(raw);
                if (bytes.Length == 6)
                    return string.Join(":",
                        bytes.Select(b => b.ToString("X2")));

                // Longer than 6 bytes — format as hex string for display
                return BitConverter.ToString(bytes).Replace("-", ":");
            }
            catch
            {
                return raw; // fallback: return whatever we have
            }
        }

        // ── Topology resolution ───────────────────────────────────────────────

        private async Task BuildTopologyAsync(CancellationToken ct)
        {
            await using var db = await _dbFactory.CreateDbContextAsync(ct);
            var allSwitches = await db.Switches.ToListAsync(ct);

            // FIX: resolve ALL neighbors every time, not just unresolved ones.
            // If a switch was renamed or re-scanned, we want the link updated.
            var allNeighbors = await db.SwitchNeighbors.ToListAsync(ct);

            int resolved = 0;
            foreach (var neighbor in allNeighbors)
            {
                if (string.IsNullOrEmpty(neighbor.RemoteSysName)) continue;

                var remoteShortName = neighbor.RemoteSysName.Split('.')[0].Trim();

                SmmSwitch? remote =
                    allSwitches.FirstOrDefault(s =>
                        !string.IsNullOrEmpty(s.Hostname) &&
                        s.Hostname.Equals(neighbor.RemoteSysName, StringComparison.OrdinalIgnoreCase))
                    ?? allSwitches.FirstOrDefault(s =>
                        !string.IsNullOrEmpty(s.Hostname) &&
                        s.Hostname.Equals(remoteShortName, StringComparison.OrdinalIgnoreCase))
                    ?? (!string.IsNullOrEmpty(neighbor.RemoteChassisId)
                        ? allSwitches.FirstOrDefault(s =>
                            s.MacAddress != null &&
                            s.MacAddress.Replace(":", "").Equals(
                                neighbor.RemoteChassisId.Replace(":", ""),
                                StringComparison.OrdinalIgnoreCase))
                        : null)
                    ?? (!string.IsNullOrEmpty(neighbor.RemoteIp)
                        ? allSwitches.FirstOrDefault(s =>
                            s.IpAddress != null &&
                            s.IpAddress.Equals(neighbor.RemoteIp, StringComparison.OrdinalIgnoreCase))
                        : null);

                if (remote != null)
                {
                    neighbor.RemoteSwitchId = remote.SwitchId;
                    resolved++;
                }
            }

            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Topology: resolved {Resolved}/{Total} neighbor links",
                resolved, allNeighbors.Count);
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private static List<string> ExpandPool(IpPoolConfig pool)
        {
            var ips = new List<string>();

            if (!string.IsNullOrWhiteSpace(pool.StartIp) && !string.IsNullOrWhiteSpace(pool.EndIp))
            {
                var start = IpToLong(pool.StartIp);
                var end = IpToLong(pool.EndIp);
                for (long i = start; i <= end; i++)
                    ips.Add(LongToIp(i));
            }

            if (!string.IsNullOrWhiteSpace(pool.SpecificIps))
                foreach (var ip in pool.SpecificIps.Split(',', StringSplitOptions.RemoveEmptyEntries))
                    if (!ips.Contains(ip.Trim())) ips.Add(ip.Trim());

            return ips;
        }

        private static long IpToLong(string ip)
        {
            var bytes = IPAddress.Parse(ip).GetAddressBytes();
            return (long)bytes[0] << 24 | (long)bytes[1] << 16 | (long)bytes[2] << 8 | bytes[3];
        }

        private static string LongToIp(long ip) =>
            $"{(ip >> 24) & 0xFF}.{(ip >> 16) & 0xFF}.{(ip >> 8) & 0xFF}.{ip & 0xFF}";

        private static async Task<bool> PingAsync(string ip)
        {
            try
            {
                using var ping = new Ping();
                var reply = await ping.SendPingAsync(ip, 500);
                return reply.Status == IPStatus.Success;
            }
            catch { return false; }
        }

        private async Task MarkUnreachableAsync(string ip)
        {
            await using var db = await _dbFactory.CreateDbContextAsync();
            var sw = await db.Switches.FirstOrDefaultAsync(s => s.IpAddress == ip);
            if (sw != null)
            {
                sw.IsReachable = false;
                sw.LastScanDate = DateTime.Now;
                await db.SaveChangesAsync();
            }
        }

        private static (string vendor, string model, string layer)
            DetectVendorAndModel(string sysDescr, string ip)
        {
            var desc = sysDescr?.ToLowerInvariant() ?? string.Empty;
            string vendor = "Unknown", model = "Unknown", layer = "L2";

            if (desc.Contains("cisco") || desc.Contains("cbs"))
            {
                vendor = "Cisco";

                var cbsMatch = System.Text.RegularExpressions.Regex.Match(
                    sysDescr, @"CBS\d{3}[-\w]+",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);

                if (cbsMatch.Success)
                {
                    model = cbsMatch.Value;
                }
                else
                {
                    var catMatch = System.Text.RegularExpressions.Regex.Match(
                        sysDescr, @"Catalyst\s+([\w\-]+)",
                        System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                    if (catMatch.Success)
                        model = "Catalyst " + catMatch.Groups[1].Value;
                }

                if (model == "Unknown" && !string.IsNullOrWhiteSpace(sysDescr))
                    model = sysDescr.Split(' ', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault() ?? "Unknown";

                if (desc.Contains("layer 3") || desc.Contains("l3") || desc.Contains("ip routing"))
                    layer = "L3";
            }
            else if (desc.Contains("aruba") || desc.Contains("hp") || desc.Contains("hewlett"))
            {
                vendor = desc.Contains("aruba") ? "Aruba" : "HP";

                var hpMatch = System.Text.RegularExpressions.Regex.Match(
                    sysDescr, @"(Aruba\s+[\w\-]+|HP\s+\d+[\w\-]*)",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (hpMatch.Success) model = hpMatch.Value;

                if (desc.Contains("8320") || desc.Contains("8400") ||
                    desc.Contains("6300") || desc.Contains("9850") || desc.Contains("routing"))
                    layer = "L3";
            }

            if (model == "Unknown" && !string.IsNullOrWhiteSpace(sysDescr))
                model = sysDescr.Length > 50 ? sysDescr[..50] : sysDescr;

            // Add this block BEFORE the Cisco check
            if (desc.Contains("fortinet") || desc.Contains("fortigate") ||
                desc.Contains("fortiswitch") || desc.Contains("fortios") || desc.Contains("firewall"))
            {
                vendor = "Fortinet";

                // Try to extract model: FortiGate-100F, FortiGate-60E, FortiSwitch-248E, etc.
                var fgMatch = System.Text.RegularExpressions.Regex.Match(
                    sysDescr, @"(FortiGate|FortiSwitch|FortiWifi)[-\s]?([\w\-]+)",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (fgMatch.Success)
                    model = fgMatch.Groups[1].Value + "-" + fgMatch.Groups[2].Value;

                // Fortinet firewalls are always L3
                layer = "Firewall";

                return (vendor, model, layer);
            }

            return (vendor, model, layer);
        }
        private async Task ScanFortinetInterfacesAsync(
    SmmSwitch sw, SystemMonitorContext db, string? poolName, CancellationToken ct)
        {
            var descrs = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfDescr, poolName: poolName);
            var opers = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfOperStatus, poolName: poolName);
            var admins = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfAdminStatus, poolName: poolName);
            var speeds = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfHighSpeed, poolName: poolName);
            var types = await _snmp.GetBulkAsync(sw.IpAddress!, OidConstants.IfType, poolName: poolName);

            foreach (var kv in descrs)
            {
                var ifIndexStr = kv.Key.Split('.').Last();
                if (!int.TryParse(ifIndexStr, out int ifIndex))
                    continue;

                var portName = kv.Value?.Trim();

                // 🔥 Only real ports (FortiGate naming)
                if (string.IsNullOrWhiteSpace(portName) ||
                    !(portName.StartsWith("port") || portName.StartsWith("wan")))
                    continue;

                types.TryGetValue($"{OidConstants.IfType}.{ifIndex}", out var typeStr);
                if (int.TryParse(typeStr, out int ifTypeVal) &&
                    (ifTypeVal == 24 || ifTypeVal == 131)) // loopback/tunnel
                    continue;

                var port = sw.Ports.FirstOrDefault(p => p.IfIndex == ifIndex)
                           ?? new SmmSwitchPort { SwitchId = sw.SwitchId, IfIndex = ifIndex };

                port.PortName = portName;

                if (opers.TryGetValue($"{OidConstants.IfOperStatus}.{ifIndex}", out var op)
                    && int.TryParse(op, out int opInt))
                    port.OperStatus = opInt;

                if (admins.TryGetValue($"{OidConstants.IfAdminStatus}.{ifIndex}", out var adm)
                    && int.TryParse(adm, out int admInt))
                    port.AdminStatus = admInt;

                if (speeds.TryGetValue($"{OidConstants.IfHighSpeed}.{ifIndex}", out var spd)
                    && long.TryParse(spd, out long mbps))
                    port.SpeedMbps = mbps;

                if (int.TryParse(typeStr, out int typeInt))
                    port.IfType = typeInt;

                port.LastUpdated = DateTime.Now;

                if (port.PortId == 0)
                    sw.Ports.Add(port);
            }

            await db.SaveChangesAsync(ct);
        }

        public async Task<List<EndpointDto>> GetEndpointsAsync(
            int? switchId = null, CancellationToken ct = default)
        {
            await using var db = await _dbFactory.CreateDbContextAsync(ct);

            var query = db.SwitchNeighbors
                .Include(n => n.LocalSwitch)
                .Where(n => n.IsEndpoint);

            if (switchId.HasValue)
                query = query.Where(n => n.LocalSwitchId == switchId.Value);

            var rows = await query
                .OrderBy(n => n.LocalSwitch!.Hostname)
                .ThenBy(n => n.LocalPortName)
                .ToListAsync(ct);

            return rows.Select(n => new EndpointDto
            {
                SwitchId = n.LocalSwitchId,
                SwitchHostname = n.LocalSwitch?.Hostname ?? n.LocalSwitchId.ToString(),
                SwitchIp = n.LocalSwitch?.IpAddress,
                LocalPort = n.LocalPortName,
                DeviceName = n.RemoteSysName,
                DeviceType = InferDeviceType(n.RemoteSysName, n.RemotePortName),
                DevicePort = n.RemotePortName,
                DeviceIp = n.RemoteIp,
                DeviceMac = n.RemoteChassisId,
                Protocol = n.Protocol,
                LastSeen = n.LastSeen.HasValue ? n.LastSeen.Value : DateTime.Now
            }).ToList();
        }


        private static string FormatMac(string raw)
        {
            var hex = new string(raw.Where(c => "0123456789ABCDEFabcdef".Contains(c)).ToArray());
            if (hex.Length < 12) return raw;
            return string.Join(":", Enumerable.Range(0, 6).Select(i => hex.Substring(i * 2, 2).ToUpper()));
        }

        private static string SanitizeName(string name) => name.Split('.')[0].Trim();

        private static long ParseUptime(string raw)
        {
            if (long.TryParse(raw.Split(' ')[0], out long ticks))
                return ticks / 100;
            return 0;
        }



        private static string InferDeviceType(string? sysName, string? portName)
        {
            var name = (sysName ?? "").ToUpperInvariant();
            var port = (portName ?? "").ToUpperInvariant();

            if (name.Contains("SEP") || name.Contains("CP-") || port.Contains("PHONE"))
                return "IP Phone";
            if (name.Contains("-AP") || name.Contains("AP-") || name.Contains("AIR-"))
                return "Access Point";
            if (name.Contains("-PC") || name.Contains("LAPTOP") || name.Contains("DESKTOP"))
                return "PC";
            if (name.Contains("PRINTER") || name.Contains("PRN"))
                return "Printer";
            if (port.Contains("DISPLAY") || name.Contains("STANDEE"))
                return "Display";

            return "Endpoint";
        }
    }

    public class ScanResult
    {
        public string? PoolName { get; set; }
        public int SwitchesFound { get; set; }
        public int SwitchesUpdated { get; set; }
        public int Errors { get; set; }
        public List<string> Messages { get; set; } = new();

        public void Merge(ScanResult other)
        {
            SwitchesFound += other.SwitchesFound;
            SwitchesUpdated += other.SwitchesUpdated;
            Errors += other.Errors;
            Messages.AddRange(other.Messages);
        }
    }

    public class EndpointDto
    {
        public int SwitchId { get; set; }
        public string? SwitchHostname { get; set; }
        public string? SwitchIp { get; set; }
        public string? LocalPort { get; set; }   // switch port it's plugged into
        public string? DeviceName { get; set; }
        public string? DeviceType { get; set; }   // "IP Phone", "Access Point", "PC" ...
        public string? DevicePort { get; set; }
        public string? DeviceIp { get; set; }
        public string? DeviceMac { get; set; }
        public string? Protocol { get; set; }
        public DateTime LastSeen { get; set; }
    }
}