namespace SystemMonitorAPI.Model
{
    public class ControllerScanResult
    {
        public string ControllerIp { get; set; } = "";
        public DateTime ScannedAt { get; set; }
        public int TotalClients { get; set; }
        public List<ArubaAp> Aps { get; set; } = new();
    }

    public class ArubaAp
    {
        public string Name { get; set; } = "";
        public string? IpAddress { get; set; }
        public string? Location { get; set; }
        public bool IsUp { get; set; }
        public int SnmpClientCount { get; set; }  // from AP table
        public DateTime LastSeen { get; set; }
        public List<WirelessClient> Clients { get; set; } = new();
    }

    public class WirelessClient
    {
        public string? MacAddress { get; set; }
        public string? IpAddress { get; set; }
        public string? Hostname { get; set; }  // from reverse DNS
        public string? ApName { get; set; }
        public string? Ssid { get; set; }
        public int? SignalDbm { get; set; }
        public string? PhyType { get; set; }
        public long? UptimeSeconds { get; set; }
        public DateTime LastSeen { get; set; }

        // Computed
        public string SignalQuality => SignalDbm switch
        {
            >= -60 => "Excellent",
            >= -70 => "Good",
            >= -80 => "Fair",
            _ => "Poor"
        };

        public string UptimeDisplay => UptimeSeconds.HasValue
            ? $"{UptimeSeconds / 3600}h {(UptimeSeconds % 3600) / 60}m"
            : "—";
    }
}
