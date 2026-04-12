namespace SystemMonitorAPI.Model
{
    public class NetworkScannerConfig
    {
        public int ScanIntervalMinutes { get; set; }
        public int SnmpTimeoutMs { get; set; }
        public int SnmpRetries { get; set; }
        public List<IPPool> IPPools { get; set; } = new();
    }

    public class IPPool
    {
        public string Name { get; set; }
        public string StartIP { get; set; }
        public string EndIP { get; set; }
        public string SnmpCommunity { get; set; }
        public string SnmpVersion { get; set; }
    }
}
