namespace SystemMonitorAPI.DTOs
{
    // ─── Switch list response ─────────────────────────────────────────────────

    public class SwitchSummaryDto
    {
        public int SwitchId { get; set; }
        public string IpAddress { get; set; } = string.Empty;
        public string Hostname { get; set; } = string.Empty;
        public string Vendor { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string SwitchLayer { get; set; } = string.Empty;
        public string Location { get; set; } = string.Empty;
        public bool IsReachable { get; set; }
        public string UptimeDisplay { get; set; } = string.Empty;
        public DateTime? LastScanDate { get; set; }
        public string PoolName { get; set; } = string.Empty;

        /// <summary>
        /// List of uplinks: "from SwitchName via GigabitEthernet1/0/1 → remote GigabitEthernet0/1"
        /// </summary>
        public List<UplinkDto> Uplinks { get; set; } = new();

        public int TotalPorts { get; set; }
        public int PortsUp { get; set; }
        public int PortsDown { get; set; }
    }

    public class UplinkDto
    {
        public string LocalPortName { get; set; } = string.Empty;
        public string RemoteSysName { get; set; } = string.Empty;
        public string RemotePortName { get; set; } = string.Empty;
        public string RemoteIp { get; set; } = string.Empty;
        public int? RemoteSwitchId { get; set; }
        public string Protocol { get; set; } = string.Empty;
    }

    // ─── Switch detail (full ports list) ─────────────────────────────────────

    public class SwitchDetailDto : SwitchSummaryDto
    {
        public string SysDescr { get; set; } = string.Empty;
        public string FirmwareVersion { get; set; } = string.Empty;
        public string Contact { get; set; } = string.Empty;
        public string MacAddress { get; set; } = string.Empty;
        public List<PortDto> Ports { get; set; } = new();
    }

    public class PortDto
    {
        public int PortId { get; set; }
        public int IfIndex { get; set; }
        public string PortName { get; set; } = string.Empty;
        public string PortAlias { get; set; } = string.Empty;
        public string MacAddress { get; set; } = string.Empty;
        public long? SpeedMbps { get; set; }
        public string AdminStatus { get; set; } = string.Empty;
        public string OperStatus { get; set; } = string.Empty;
        public bool IsUplink { get; set; }
        public int? VlanId { get; set; }
    }

    // ─── Topology (for diagram rendering) ────────────────────────────────────

    public class TopologyDto
    {
        public List<TopologyNode> Nodes { get; set; } = new();
        public List<TopologyEdge> Edges { get; set; } = new();
    }

    public class TopologyNode
    {
        public int Id { get; set; }   // SwitchId
        public string Label { get; set; } = string.Empty;
        public string IpAddress { get; set; } = string.Empty;
        public string Vendor { get; set; } = string.Empty;
        public string Model { get; set; } = string.Empty;
        public string SwitchLayer { get; set; } = string.Empty;
        public bool IsReachable { get; set; }
        public string Color { get; set; } = string.Empty; // hex colour for UI
        public string Group { get; set; } = string.Empty; // PoolName for grouping
    }

    public class TopologyEdge
    {
        public int Id { get; set; }  // NeighborId
        public int From { get; set; }  // LocalSwitchId
        public int To { get; set; }  // RemoteSwitchId
        public string LocalPort { get; set; } = string.Empty;
        public string RemotePort { get; set; } = string.Empty;
        public string Protocol { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty; // "Gi1/0/1 → Gi0/1"
    }

    // ─── Scan trigger response ────────────────────────────────────────────────

    public class ScanStatusDto
    {
        public bool IsRunning { get; set; }
        public string? LastScanStart { get; set; }
        public string? LastScanEnd { get; set; }
        public int SwitchesFound { get; set; }
        public string? Message { get; set; }
    }
    public class DevicePortDto
    {
        public string? Hostname { get; set; }
        public string? Username { get; set; }
        public string? Department { get; set; }
        public string? Status { get; set; }
        public int? ConnectedSwitchId { get; set; }
        public string? ConnectedSwitchName { get; set; }
        public string? ConnectedSwitchIp { get; set; }
        public string? ConnectedPort { get; set; }
        public string? ConnectionProtocol { get; set; }
        public DateTime? PortLastSeen { get; set; }
    }
}