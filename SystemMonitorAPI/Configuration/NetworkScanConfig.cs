namespace SystemMonitorAPI.Configuration
{
    /// <summary>
    /// Root config section: "NetworkScan" in appsettings.json
    /// </summary>
    public class NetworkScanConfig
    {
        public List<IpPoolConfig> IpPools { get; set; } = new();
        public List<SnmpV3Config> SnmpV3 { get; set; } = new();

        /// <summary>
        /// How often to auto-scan in minutes (0 = manual only)
        /// </summary>
        public int ScanIntervalMinutes { get; set; } = 60;

        /// <summary>
        /// Max parallel IPs to scan simultaneously
        /// </summary>
        public int MaxParallelScans { get; set; } = 20;

        /// <summary>
        /// Quick ICMP ping timeout ms before SNMP attempt
        /// </summary>
        public int PingTimeoutMs { get; set; } = 500;
    }

    public class IpPoolConfig
    {
        /// <summary>
        /// Friendly name shown in UI e.g. "DataCenter-Floor1"
        /// </summary>
        public string Name { get; set; } = string.Empty;

        /// <summary>
        /// Start IP of the range e.g. "192.168.1.1"
        /// </summary>
        public string StartIp { get; set; } = string.Empty;

        /// <summary>
        /// End IP of the range e.g. "192.168.1.254"
        /// </summary>
        public string EndIp { get; set; } = string.Empty;

        /// <summary>
        /// Optional: comma-separated specific IPs in addition to range
        /// </summary>
        public string? SpecificIps { get; set; }

        /// <summary>
        /// Enable/disable this pool without removing it
        /// </summary>
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Must match the "Label" of one entry in the SnmpV3 array.
        /// If left empty the service will try ALL credentials in order
        /// (slower — only use as fallback).
        /// </summary>
        public string? SnmpCredentialLabel { get; set; }
    }

    public class SnmpV3Config
    {
        /// <summary>
        /// Friendly label shown in logs e.g. "DataCenter-Creds", "Floor1-Creds"
        /// Optional — defaults to Username if not set.
        /// </summary>
        public string? Label { get; set; }
        /// <summary>
        /// SNMPv3 security username (same across all switches)
        /// </summary>
        public string Username { get; set; } = string.Empty;

        /// <summary>
        /// Auth protocol: MD5 or SHA (SHA recommended)
        /// </summary>
        public string AuthProtocol { get; set; } = "SHA";

        /// <summary>
        /// Authentication password
        /// </summary>
        public string AuthPassword { get; set; } = string.Empty;

        /// <summary>
        /// Privacy/encryption protocol: DES, AES128, AES256
        /// </summary>
        public string PrivProtocol { get; set; } = "DES";

        /// <summary>
        /// Privacy/encryption password
        /// </summary>
        public string PrivPassword { get; set; } = string.Empty;

        /// <summary>
        /// SNMP UDP port (default 161)
        /// </summary>
        public int Port { get; set; } = 161;

        /// <summary>
        /// Request timeout in milliseconds
        /// </summary>
        public int TimeoutMs { get; set; } = 3000;

        /// <summary>
        /// Number of retries on timeout
        /// </summary>
        public int Retries { get; set; } = 1;
        public string DisplayLabel => Label ?? Username;
    }
}