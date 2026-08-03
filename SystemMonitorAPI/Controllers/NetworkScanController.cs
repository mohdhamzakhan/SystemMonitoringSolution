using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SystemMonitorAPI.DTOs;
using SystemMonitorAPI.Model;
using SystemMonitorAPI.Models;
using SystemMonitorAPI.Services;

namespace SystemMonitorAPI.Controllers
{
    /// <summary>
    /// REST API for network switch scanning and topology.
    ///
    /// Endpoints:
    ///   GET  /api/networkscan/switches          - List all switches (summary + uplinks)
    ///   GET  /api/networkscan/switches/{id}     - Full switch detail + port list
    ///   GET  /api/networkscan/topology          - Nodes + edges for diagram
    ///   POST /api/networkscan/scan              - Trigger scan of all pools
    ///   POST /api/networkscan/scan/{poolName}   - Trigger scan of a specific pool
    ///   POST /api/networkscan/scan/ip/{ip}      - Scan one IP
    ///   GET  /api/networkscan/status            - Current scan status
    ///   GET  /api/networkscan/pools             - List configured IP pools
    ///   POST /api/device/resolve-ports         - Trigger device port resolution (hostname → switch+port)
    ///   POST /api/device/resolve-ports/{hostname} - Trigger device port resolution for a specific hostname
    ///   GET /api/device/port-map                - Get current device → switch+port mapping
    /// GET /api/networkscan/endpoints            - Get all endpoints discovered in the last scan, with optional filtering
    /// GET /api/networkscan/endpoints?switchId=5 - Get endpoints for a specific switch
    /// GET /api/networkscan/endpoints?type=Access Point - Get endpoints of a specific type (e.g. "Access Point", "Printer", "Workstation")
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class NetworkScanController : ControllerBase
    {
        private readonly INetworkScanService _scanner;
        private readonly SystemMonitorContext _db;
        private readonly ILogger<NetworkScanController> _logger;
        private readonly IDevicePortResolutionService _resolver;

        // Simple in-memory scan state (replace with IMemoryCache or Redis for multi-instance)
        private static ScanStatusDto _scanStatus = new() { Message = "No scan has run yet." };
        private static bool _scanning = false;

        public NetworkScanController(
            INetworkScanService scanner,
            SystemMonitorContext db,
            ILogger<NetworkScanController> logger,
            IDevicePortResolutionService resolver)
        {
            _scanner = scanner;
            _db = db;
            _logger = logger;
            _resolver = resolver;
        }

        // ─── GET /api/networkscan/switches ────────────────────────────────────

        [HttpGet("switches")]
        public async Task<ActionResult<IEnumerable<SwitchSummaryDto>>> GetSwitches(
            [FromQuery] bool activeOnly = true,
            [FromQuery] string? vendor = null,
            [FromQuery] string? layer = null,
            [FromQuery] string? pool = null)
        {
            var query = _db.Switches
                .Include(s => s.Ports)
                .Include(s => s.NeighborsAsLocal)
                    .ThenInclude(n => n.RemoteSwitch)
                .AsQueryable();

            if (activeOnly) query = query.Where(s => s.IsActive);
            if (!string.IsNullOrEmpty(vendor)) query = query.Where(s => s.Vendor == vendor);
            if (!string.IsNullOrEmpty(layer)) query = query.Where(s => s.SwitchLayer == layer);
            if (!string.IsNullOrEmpty(pool)) query = query.Where(s => s.PoolName == pool);

            var switches = await query.OrderBy(s => s.Hostname).ToListAsync();
            return Ok(switches.Select(s => MapToSummaryDto(s)));
        }

        // ─── GET /api/networkscan/switches/{id} ───────────────────────────────

        [HttpGet("switches/{id:int}")]
        public async Task<ActionResult<SwitchDetailDto>> GetSwitch(int id)
        {
            var sw = await _db.Switches
                .Include(s => s.Ports)
                .Include(s => s.NeighborsAsLocal)
                    .ThenInclude(n => n.RemoteSwitch)
                .FirstOrDefaultAsync(s => s.SwitchId == id);

            if (sw == null) return NotFound($"Switch {id} not found.");

            var dto = MapToDetailDto(sw);
            return Ok(dto);
        }

        // ─── GET /api/networkscan/topology ────────────────────────────────────

        [HttpGet("topology")]
        public async Task<ActionResult<TopologyDto>> GetTopology()
        {
            var switches = await _db.Switches
                .Where(s => s.IsActive)
                .ToListAsync();

            // Only include edges where BOTH ends are known managed switches
            var neighbors = await _db.SwitchNeighbors
                .Where(n => n.RemoteSwitchId != null)
                .ToListAsync();

            // De-duplicate bidirectional edges
            var seenEdges = new HashSet<string>();
            var edges = new List<TopologyEdge>();

            foreach (var n in neighbors)
            {
                var key = string.Join("-", new[] { n.LocalSwitchId, n.RemoteSwitchId!.Value }.Order());
                var keyP = $"{key}-{n.LocalPortName}-{n.RemotePortName}";
                if (!seenEdges.Add(keyP)) continue;

                edges.Add(new TopologyEdge
                {
                    Id = n.NeighborId,
                    From = n.LocalSwitchId,
                    To = n.RemoteSwitchId!.Value,
                    LocalPort = n.LocalPortName ?? string.Empty,
                    RemotePort = n.RemotePortName ?? string.Empty,
                    Protocol = n.Protocol ?? string.Empty,
                    Label = $"{ShortPort(n.LocalPortName)} → {ShortPort(n.RemotePortName)}"
                });
            }

            var topology = new TopologyDto
            {
                Nodes = switches.Select(s => new TopologyNode
                {
                    Id = s.SwitchId,
                    Label = s.Hostname ?? s.IpAddress ?? "?",
                    IpAddress = s.IpAddress ?? string.Empty,
                    Vendor = s.Vendor ?? string.Empty,
                    Model = s.Model ?? string.Empty,
                    SwitchLayer = s.SwitchLayer ?? string.Empty,
                    IsReachable = s.IsReachable,
                    Group = s.PoolName ?? string.Empty,
                    Color = GetNodeColor(s)
                }).ToList(),
                Edges = edges
            };

            return Ok(topology);
        }

        // ─── POST /api/networkscan/scan ───────────────────────────────────────

        [HttpPost("scan")]
        public async Task<ActionResult<ScanStatusDto>> TriggerFullScan(CancellationToken ct)
        {
            if (_scanning)
                return Conflict(new ScanStatusDto { IsRunning = true, Message = "A scan is already in progress." });

            _ = Task.Run(async () =>
            {
                _scanning = true;
                var start = DateTime.Now;
                _scanStatus = new ScanStatusDto { IsRunning = true, LastScanStart = start.ToString("o") };
                try
                {
                    var result = await _scanner.ScanAllPoolsAsync(ct);
                    // Auto-resolve device → switch port mapping
                    await _resolver.ResolveAllAsync(ct);
                    _scanStatus = new ScanStatusDto
                    {
                        IsRunning = false,
                        LastScanStart = start.ToString("o"),
                        LastScanEnd = DateTime.Now.ToString("o"),
                        SwitchesFound = result.SwitchesFound,
                        Message = $"Scan complete. {result.SwitchesFound} switches found."
                    };
                }
                catch (Exception ex)
                {
                    _scanStatus = new ScanStatusDto { IsRunning = false, Message = $"Scan failed: {ex.Message}" };
                }
                finally { _scanning = false; }
            }, ct);

            return Accepted(_scanStatus);
        }

        // ─── POST /api/networkscan/scan/{poolName} ───────────────────────────

        [HttpPost("scan/{poolName}")]
        public async Task<ActionResult<ScanStatusDto>> TriggerPoolScan(string poolName, CancellationToken ct)
        {
            if (_scanning)
                return Conflict(new ScanStatusDto { IsRunning = true, Message = "A scan is already in progress." });

            _ = Task.Run(async () =>
            {
                _scanning = true;
                try
                {
                    await _scanner.ScanPoolAsync(poolName, ct);
                }
                finally { _scanning = false; }
            }, ct);


            return Accepted(new ScanStatusDto { IsRunning = true, Message = $"Scanning pool: {poolName}" });
        }

        // ─── POST /api/networkscan/scan/ip/{ipAddress} ───────────────────────

        [HttpPost("scan/ip/{ipAddress}")]
        public async Task<ActionResult<SwitchDetailDto?>> ScanSingleIp(string ipAddress, CancellationToken ct)
        {
            await _scanner.ScanSingleIpAsync(ipAddress);

            var sw = await _db.Switches
                .Include(s => s.Ports)
                .Include(s => s.NeighborsAsLocal).ThenInclude(n => n.RemoteSwitch)
                .FirstOrDefaultAsync(s => s.IpAddress == ipAddress, ct);

            return sw == null ? NotFound() : Ok(MapToDetailDto(sw));
        }

        // ─── GET /api/networkscan/status ─────────────────────────────────────

        [HttpGet("status")]
        public ActionResult<ScanStatusDto> GetStatus() => Ok(_scanStatus);

        // ─── GET /api/networkscan/pools ──────────────────────────────────────

        [HttpGet("pools")]
        public ActionResult<IEnumerable<object>> GetPools(
             [FromServices] IOptions<Configuration.NetworkScanConfig> cfg)
        {
            var config = cfg.Value;
            return Ok(config.IpPools.Select(p => new
            {
                p.Name,
                p.StartIp,
                p.EndIp,
                p.Enabled,
                IpCount = CalculateIpCount(p.StartIp, p.EndIp)
            }));
        }

        // ─── POST /api/device/resolve-ports ───────────────────────────────────

        [HttpPost("resolve-ports")]
        public async Task<ActionResult<DevicePortResolutionResult>> ResolvePorts(CancellationToken ct)
        {
            var result = await _resolver.ResolveAllAsync(ct);
            return result.Error != null ? BadRequest(result) : Ok(result);
        }

        // ─── POST /api/device/resolve-ports/{hostname} ────────────────────────

        [HttpPost("resolve-ports/{hostname}")]
        public async Task<ActionResult<DevicePortResolutionResult>> ResolveDevice(
        string hostname, CancellationToken ct)
        {
            var result = await _resolver.ResolveDeviceAsync(hostname, ct);
            return result.Error != null ? NotFound(result) : Ok(result);
        }

        // ─── GET /api/device/port-map  ────────────────────────────────────────

        [HttpGet("port-map")]
        public async Task<ActionResult<IEnumerable<DevicePortDto>>> GetPortMap(
        [FromQuery] bool unmappedOnly = false)
        {
            var query = _db.Devices
                .Include(d => d.ConnectedSwitch)
                .AsQueryable();

            if (unmappedOnly)
                query = query.Where(d => d.ConnectedSwitchId == null);

            var devices = await query
                .OrderBy(d => d.ConnectedSwitchName)
                .ThenBy(d => d.ConnectedPort)
                .ToListAsync();

            return Ok(devices.Select(d => new DevicePortDto
            {
                Hostname = d.Hostname,
                Username = d.Username,
                Department = d.Department,
                Status = d.Status,
                ConnectedSwitchId = d.ConnectedSwitchId,
                ConnectedSwitchName = d.ConnectedSwitchName,
                ConnectedSwitchIp = d.ConnectedSwitchIp,
                ConnectedPort = d.ConnectedPort,
                ConnectionProtocol = d.ConnectionProtocol,
                PortLastSeen = d.PortLastSeen
            }));
        }
        [HttpGet("port-ap-map")]
        public async Task<ActionResult<IEnumerable<DevicePortDto>>> GetPortMapForAP(
            [FromQuery] bool unmappedOnly = false)
        {
            var query = _db.SwitchNeighbors
                .Include(n => n.LocalSwitch)
                .Include(n => n.LocalPort)
                .AsQueryable();

            // AP detection (more robust than strict "eth0")
            query = query.Where(x =>
                x.RemotePortName != null &&
                x.RemotePortName.ToLower().Contains("eth0"));

            // Apply unmapped filter if needed
            if (unmappedOnly)
            {
                query = query.Where(x => x.RemoteSwitchId == null);
            }

            var devices = await query
                .OrderBy(x => x.LocalSwitchId)
                .ToListAsync();

            // 🔧 Drop rows with a missing/garbled RemoteSysName (corrupted SNMP/LLDP
            // decode) and de-dupe remaining APs by name, keeping the most recent sighting.
            var deduped = devices
                .Where(d => IsValidSysName(d.RemoteSysName))
                .GroupBy(d => d.RemoteSysName)
                .Select(g => g.OrderByDescending(x => x.LastSeen).First())
                .ToList();

            var result = deduped.Select(d => new DevicePortDto
            {
                Hostname = d.RemoteSysName,
                Username = d.RemoteSysName,
                Department = d.RemoteSysName,
                Status = "Connected",

                ConnectedSwitchId = d.LocalSwitchId,
                ConnectedSwitchName = d.LocalSwitch != null ? d.LocalSwitch.Hostname : null,
                ConnectedSwitchIp = d.LocalSwitch != null ? d.LocalSwitch.IpAddress : null,

                ConnectedPort = d.LocalPortName,
                ConnectionProtocol = d.Protocol,
                PortLastSeen = d.LastSeen
            });

            return Ok(result);
        }

        // ─── VALIDATION HELPER ─────────────────────────────────────────────────
        private static bool IsValidSysName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;

            // Reject names containing the Unicode replacement character or
            // control characters — these indicate a corrupted/garbled SNMP decode.
            if (name.Any(c => c == '\uFFFD' || char.IsControl(c))) return false;

            // Require at least one real letter or digit so pure-symbol garbage
            // ("? ??Yf" style) is excluded, while legitimate names like
            // "FG-WH-AP02" still pass.
            if (!name.Any(char.IsLetterOrDigit)) return false;

            return true;
        }

        [HttpGet("endpoints")]
        public async Task<ActionResult<IEnumerable<EndpointDto>>> GetEndpoints(
    [FromQuery] int? switchId = null,
    [FromQuery] string? type = null,
    CancellationToken ct = default)
        {
            var endpoints = await _scanner.GetEndpointsAsync(switchId, ct);

            if (!string.IsNullOrEmpty(type))
                endpoints = endpoints
                    .Where(e => e.DeviceType!.Equals(type, StringComparison.OrdinalIgnoreCase))
                    .ToList();

            return Ok(endpoints);
        }

        // ─── MAPPING HELPERS ──────────────────────────────────────────────────

        private static SwitchSummaryDto MapToSummaryDto(SmmSwitch sw)
        {
            var uplinks = sw.NeighborsAsLocal
                .Select(n => new UplinkDto
                {
                    LocalPortName = n.LocalPortName ?? string.Empty,
                    RemoteSysName = n.RemoteSysName ?? string.Empty,
                    RemotePortName = n.RemotePortName ?? string.Empty,
                    RemoteIp = n.RemoteSwitch?.IpAddress ?? n.RemoteIp ?? string.Empty,
                    RemoteSwitchId = n.RemoteSwitchId,
                    Protocol = n.Protocol ?? string.Empty
                })
                .Where(u => !string.IsNullOrEmpty(u.LocalPortName))
                .ToList();

            return new SwitchSummaryDto
            {
                SwitchId = sw.SwitchId,
                IpAddress = sw.IpAddress ?? string.Empty,
                Hostname = sw.Hostname ?? sw.IpAddress ?? string.Empty,
                Vendor = sw.Vendor ?? string.Empty,
                Model = sw.Model ?? string.Empty,
                SwitchLayer = sw.SwitchLayer ?? string.Empty,
                Location = sw.Location ?? string.Empty,
                IsReachable = sw.IsReachable,
                UptimeDisplay = FormatUptime(sw.UptimeSeconds),
                LastScanDate = sw.LastScanDate,
                PoolName = sw.PoolName ?? string.Empty,
                Uplinks = uplinks,
                TotalPorts = sw.Ports.Count,
                PortsUp = sw.Ports.Count(p => p.OperStatus == 1),
                PortsDown = sw.Ports.Count(p => p.OperStatus == 2)
            };
        }

        private static SwitchDetailDto MapToDetailDto(SmmSwitch sw)
        {
            var summary = MapToSummaryDto(sw);
            return new SwitchDetailDto
            {
                SwitchId = summary.SwitchId,
                IpAddress = summary.IpAddress,
                Hostname = summary.Hostname,
                Vendor = summary.Vendor,
                Model = summary.Model,
                SwitchLayer = summary.SwitchLayer,
                Location = summary.Location,
                IsReachable = summary.IsReachable,
                UptimeDisplay = summary.UptimeDisplay,
                LastScanDate = summary.LastScanDate,
                PoolName = summary.PoolName,
                Uplinks = summary.Uplinks,
                TotalPorts = summary.TotalPorts,
                PortsUp = summary.PortsUp,
                PortsDown = summary.PortsDown,
                SysDescr = sw.SysDescr ?? string.Empty,
                FirmwareVersion = sw.FirmwareVersion ?? string.Empty,
                Contact = sw.Contact ?? string.Empty,
                MacAddress = sw.MacAddress ?? string.Empty,
                Ports = sw.Ports.Select(p => new PortDto
                {
                    PortId = p.PortId,
                    IfIndex = p.IfIndex,
                    PortName = p.PortName ?? string.Empty,
                    PortAlias = p.PortAlias ?? string.Empty,
                    MacAddress = p.MacAddress ?? string.Empty,
                    SpeedMbps = p.SpeedMbps,
                    AdminStatus = p.AdminStatus == 1 ? "Up" : p.AdminStatus == 2 ? "Down" : "Testing",
                    OperStatus = p.OperStatus == 1 ? "Up" : p.OperStatus == 2 ? "Down" : "Unknown",
                    IsUplink = p.IsUplink,
                    VlanId = p.VlanId
                }).OrderBy(p => p.IfIndex).ToList()
            };
        }

        private static string FormatUptime(long? seconds)
        {
            if (!seconds.HasValue || seconds == 0) return "Unknown";
            var ts = TimeSpan.FromSeconds(seconds.Value);
            return $"{(int)ts.TotalDays}d {ts.Hours}h {ts.Minutes}m";
        }

        private static string GetNodeColor(SmmSwitch s)
        {
            if (!s.IsReachable) return "#FF4444";
            return s.SwitchLayer == "L3"
                ? (s.Vendor == "Cisco" ? "#1BA1E2" : "#60A917")
                : (s.Vendor == "Cisco" ? "#0050EF" : "#008A00");
        }

        private static string ShortPort(string? portName) =>
            portName == null ? "?" :
            System.Text.RegularExpressions.Regex.Replace(portName,
                @"(GigabitEthernet|FastEthernet|TenGigabitEthernet|FortyGigabitEthernet)",
                m => m.Value switch
                {
                    "GigabitEthernet" => "Gi",
                    "FastEthernet" => "Fa",
                    "TenGigabitEthernet" => "Te",
                    "FortyGigabitEthernet" => "Fo",
                    _ => m.Value
                }, System.Text.RegularExpressions.RegexOptions.IgnoreCase);

        private static int CalculateIpCount(string start, string end)
        {
            try
            {
                var s = System.Net.IPAddress.Parse(start).GetAddressBytes();
                var e = System.Net.IPAddress.Parse(end).GetAddressBytes();
                return (int)((long)e[3] + e[2] * 256 + e[1] * 65536 + e[0] * 16777216L
                           - ((long)s[3] + s[2] * 256 + s[1] * 65536 + s[0] * 16777216L)) + 1;
            }
            catch { return 0; }
        }
    }
}