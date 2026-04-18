using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SystemMonitorAPI.Configuration;
using SystemMonitorAPI.Model;

[ApiController]
[Route("api/wireless")]
public class WirelessController : ControllerBase
{
    private readonly IWirelessScanService _wifi;
    private readonly IOptions<NetworkScanConfig> _cfg;

    public WirelessController(IWirelessScanService wifi, IOptions<NetworkScanConfig> cfg)
    {
        _wifi = wifi;
        _cfg = cfg;
    }

    // GET /api/wireless/scan
    // Scans all enabled controllers from config
    [HttpGet("scan")]
    public async Task<ActionResult<List<ControllerScanResult>>> ScanAll(CancellationToken ct)
    {
        var controllers = _cfg.Value.ArubaControllers.Where(c => c.Enabled).ToList();
        if (!controllers.Any())
            return BadRequest("No Aruba controllers configured.");

        var results = new List<ControllerScanResult>();
        foreach (var ctrl in controllers)
        {
            var result = await _wifi.ScanControllerAsync(
                ctrl.IpAddress, ctrl.SnmpCredentialLabel, ct);
            results.Add(result);
        }
        return Ok(results);
    }

    // GET /api/wireless/aps
    // List all APs with client counts
    [HttpGet("aps")]
    public async Task<ActionResult> GetAps(CancellationToken ct)
    {
        var result = await ScanFirstController(ct);
        if (result == null) return BadRequest("No controller configured.");

        return Ok(result.Aps.Select(a => new
        {
            a.Name,
            a.IpAddress,
            a.Location,
            a.IsUp,
            ClientCount = a.Clients.Count,
            a.LastSeen
        }));
    }

    // GET /api/wireless/aps/{apName}
    // Full AP detail with all connected clients
    [HttpGet("aps/{apName}")]
    public async Task<ActionResult> GetAp(string apName, CancellationToken ct)
    {
        var result = await ScanFirstController(ct);
        if (result == null) return BadRequest("No controller configured.");

        var ap = result.Aps.FirstOrDefault(a =>
            string.Equals(a.Name, apName, StringComparison.OrdinalIgnoreCase));

        if (ap == null) return NotFound($"AP '{apName}' not found.");

        return Ok(new
        {
            ap.Name,
            ap.IpAddress,
            ap.Location,
            ap.IsUp,
            ClientCount = ap.Clients.Count,
            Clients = ap.Clients.Select(MapClient)
        });
    }

    // GET /api/wireless/clients
    // Search clients — by MAC, IP, hostname, or SSID
    [HttpGet("clients")]
    public async Task<ActionResult> GetClients(
        [FromQuery] string? mac = null,
        [FromQuery] string? ip = null,
        [FromQuery] string? hostname = null,
        [FromQuery] string? ssid = null,
        [FromQuery] string? apName = null,
        CancellationToken ct = default)
    {
        var result = await ScanFirstController(ct);
        if (result == null) return BadRequest("No controller configured.");

        var clients = result.Aps.SelectMany(a =>
            a.Clients.Select(c => new { ap = a, client = c }));

        if (!string.IsNullOrEmpty(mac))
            clients = clients.Where(x =>
                string.Equals(x.client.MacAddress, mac, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrEmpty(ip))
            clients = clients.Where(x => x.client.IpAddress == ip);

        if (!string.IsNullOrEmpty(hostname))
            clients = clients.Where(x =>
                x.client.Hostname?.Contains(hostname, StringComparison.OrdinalIgnoreCase) == true);

        if (!string.IsNullOrEmpty(ssid))
            clients = clients.Where(x =>
                string.Equals(x.client.Ssid, ssid, StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrEmpty(apName))
            clients = clients.Where(x =>
                string.Equals(x.ap.Name, apName, StringComparison.OrdinalIgnoreCase));

        return Ok(clients.Select(x => new
        {
            x.client.MacAddress,
            x.client.IpAddress,
            x.client.Hostname,
            ConnectedAp = x.ap.Name,
            ApLocation = x.ap.Location,
            x.client.Ssid,
            x.client.PhyType,
            x.client.SignalDbm,
            x.client.SignalQuality,
            x.client.UptimeDisplay,
            x.client.LastSeen
        }));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<ControllerScanResult?> ScanFirstController(CancellationToken ct)
    {
        var ctrl = _cfg.Value.ArubaControllers.FirstOrDefault(c => c.Enabled);
        if (ctrl == null) return null;
        return await _wifi.ScanControllerAsync(ctrl.IpAddress, ctrl.SnmpCredentialLabel, ct);
    }

    private static object MapClient(WirelessClient c) => new
    {
        c.MacAddress,
        c.IpAddress,
        c.Hostname,
        c.Ssid,
        c.PhyType,
        c.SignalDbm,
        c.SignalQuality,
        c.UptimeDisplay,
        c.LastSeen
    };
}