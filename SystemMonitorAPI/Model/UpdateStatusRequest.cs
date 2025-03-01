namespace SystemMonitorAPI.Model
{
    public class UpdateStatusRequest
    {
        public int SystemID { get; set; }
        public int UpdateID { get; set; }
        public string Status { get; set; }
        public string StatusMessage { get; set; } // Optional, for additional information
    }
}
