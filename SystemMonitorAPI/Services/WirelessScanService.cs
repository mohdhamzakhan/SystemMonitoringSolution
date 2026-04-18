using SystemMonitorAPI.Model;
using SystemMonitorAPI.Services;

public interface IWirelessScanService
{
    Task<ControllerScanResult> ScanControllerAsync(
        string controllerIp, string? poolName = null, CancellationToken ct = default);
}

public class WirelessScanService : IWirelessScanService
{
    private readonly ISnmpV3Service _snmp;
    private readonly ILogger<WirelessScanService> _logger;

    public WirelessScanService(ISnmpV3Service snmp, ILogger<WirelessScanService> logger)
    {
        _snmp = snmp;
        _logger = logger;
    }

    public async Task<ControllerScanResult> ScanControllerAsync(
        string controllerIp, string? poolName = null, CancellationToken ct = default)
    {
        _logger.LogInformation("Scanning Aruba controller {IP}", controllerIp);

        // ── Step 1: Walk AP table ─────────────────────────────────────────────
        var apNames = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxApName, maxRepetitions: 15, poolName: poolName);
        var apIps = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxApIpAddress, maxRepetitions: 15, poolName: poolName);
        var apLocations = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxApLocation, maxRepetitions: 15, poolName: poolName);
        var apNumClients = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxApNumClients, maxRepetitions: 15, poolName: poolName);
        var apStatuses = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxApStatus, maxRepetitions: 15, poolName: poolName);

        // ── Step 2: Walk station table ────────────────────────────────────────
        var staIps = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaIpAddress, maxRepetitions: 15, poolName: poolName);
        var staAps = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaAssociatedAP, maxRepetitions: 15, poolName: poolName);
        var staSsids = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaEssid, maxRepetitions: 15, poolName: poolName);
        var staSignals = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaSignalStrength, maxRepetitions: 15, poolName: poolName);
        var staPhyTypes = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaPhyType, maxRepetitions: 15, poolName: poolName);
        var staUptimes = await _snmp.GetBulkAsync(controllerIp, OidConstants.WlsxStaUpTime, maxRepetitions: 15, poolName: poolName);

        _logger.LogInformation(
            "Controller {IP}: {ApCount} APs, {StaCount} stations raw from SNMP",
            controllerIp, apNames.Count, staIps.Count);

        // ── Step 3: Build AP dictionary keyed by OID suffix ───────────────────
        // The suffix is the AP's MAC bytes encoded in the OID
        // e.g. WlsxApName.24.128.80.100.1.32  →  suffix = "24.128.80.100.1.32"
        var apDict = new Dictionary<string, ArubaAp>();

        foreach (var kv in apNames)
        {
            var suffix = TrimBase(kv.Key, OidConstants.WlsxApName);
            apDict[suffix] = new ArubaAp
            {
                Name      = kv.Value.Trim(),
                LastSeen  = DateTime.Now,
                IsUp      = true
            };
        }

        // Enrich AP rows
        EnrichAps(apDict, apIps,        OidConstants.WlsxApIpAddress,
            (ap, v) => ap.IpAddress = v);
        EnrichAps(apDict, apLocations,  OidConstants.WlsxApLocation,
            (ap, v) => ap.Location = v);
        EnrichAps(apDict, apNumClients, OidConstants.WlsxApNumClients,
            (ap, v) => ap.SnmpClientCount = int.TryParse(v, out int n) ? n : 0);
        EnrichAps(apDict, apStatuses,   OidConstants.WlsxApStatus,
            (ap, v) => ap.IsUp = v == "1");

        // ── Step 4: Build client list and attach to APs ───────────────────────
        // Station OIDs are indexed by the CLIENT's MAC bytes
        var allClients = new List<WirelessClient>();

        foreach (var kv in staAps)   // walk by AssociatedAP — every client has this
        {
            var suffix = TrimBase(kv.Key, OidConstants.WlsxStaAssociatedAP);
            var apName = kv.Value.Trim();

            var client = new WirelessClient
            {
                // MAC is encoded in the OID suffix itself — decode it
                MacAddress = SuffixToMac(suffix),
                ApName     = apName,
                LastSeen   = DateTime.Now
            };

            // Look up other columns by same suffix
            if (staIps    .TryGetValue($"{OidConstants.WlsxStaIpAddress}.{suffix}",      out var ip))
                client.IpAddress = ip;

            if (staSsids  .TryGetValue($"{OidConstants.WlsxStaEssid}.{suffix}",          out var ssid))
                client.Ssid = ssid.Trim();

            if (staSignals.TryGetValue($"{OidConstants.WlsxStaSignalStrength}.{suffix}", out var rssi)
                && int.TryParse(rssi, out int rssiVal))
                client.SignalDbm = rssiVal;

            if (staPhyTypes.TryGetValue($"{OidConstants.WlsxStaPhyType}.{suffix}",      out var phy))
                client.PhyType = DecodePhyType(phy);

            if (staUptimes .TryGetValue($"{OidConstants.WlsxStaUpTime}.{suffix}",        out var up)
                && long.TryParse(up, out long ticks))
                client.UptimeSeconds = ticks / 100;

            // Try reverse DNS for hostname (best effort, don't block on it)
            if (!string.IsNullOrEmpty(client.IpAddress))
                client.Hostname = await TryReverseDnsAsync(client.IpAddress);

            // Attach to the right AP
            var matchedAp = apDict.Values.FirstOrDefault(a =>
                string.Equals(a.Name, apName, StringComparison.OrdinalIgnoreCase));
            matchedAp?.Clients.Add(client);

            allClients.Add(client);
        }

        _logger.LogInformation(
            "Controller scan done — {APs} APs up, {Clients} clients connected",
            apDict.Values.Count(a => a.IsUp), allClients.Count);

        return new ControllerScanResult
        {
            ControllerIp = controllerIp,
            ScannedAt    = DateTime.Now,
            Aps          = apDict.Values.OrderBy(a => a.Name).ToList(),
            TotalClients = allClients.Count
        };
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static void EnrichAps(
        Dictionary<string, ArubaAp> apDict,
        Dictionary<string, string> table,
        string baseOid,
        Action<ArubaAp, string> apply)
    {
        foreach (var kv in table)
        {
            var suffix = TrimBase(kv.Key, baseOid);
            if (apDict.TryGetValue(suffix, out var ap))
                apply(ap, kv.Value);
        }
    }

    private static string TrimBase(string fullOid, string baseOid)
        => fullOid.StartsWith(baseOid + ".")
            ? fullOid[(baseOid.Length + 1)..]
            : fullOid;

    // Aruba encodes MAC as 6 decimal octets in the OID suffix
    // e.g. "24.128.80.100.1.32" → "18:80:50:64:01:20"
    private static string SuffixToMac(string suffix)
    {
        try
        {
            var parts = suffix.Split('.').Take(6).ToArray();
            if (parts.Length == 6 && parts.All(p => int.TryParse(p, out _)))
                return string.Join(":", parts.Select(p => int.Parse(p).ToString("X2")));
        }
        catch { }
        return suffix;
    }

    private static string DecodePhyType(string? phy) => phy switch
    {
        "1" => "802.11a",
        "2" => "802.11b",
        "3" => "802.11g",
        "4" => "802.11n",
        "5" => "802.11ac",
        "6" => "802.11ax (Wi-Fi 6)",
        "7" => "802.11ax (Wi-Fi 6E)",
        _   => phy ?? "Unknown"
    };

    private static async Task<string?> TryReverseDnsAsync(string ip)
    {
        try
        {
            var entry = await System.Net.Dns.GetHostEntryAsync(ip);
            return entry.HostName?.Split('.')[0];
        }
        catch { return null; }
    }
}