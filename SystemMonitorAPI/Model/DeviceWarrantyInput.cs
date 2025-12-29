namespace SystemMonitorAPI.Model
{
    public class DeviceWarrantyInput
    {
        public string Hostname { get; set; }
        public SystemDetailDto SystemDetails { get; set; }
    }
    public class warrantyInfo
    {
        public string Hostname { get; set; }
        public string SerialNumber { get; set; }
        public DateTime? WarrantyStartDate { get; set; }
        public DateTime? WarrantyEndDate { get; set; }
    }
}
