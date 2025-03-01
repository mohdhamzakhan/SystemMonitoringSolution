namespace SystemMonitorAPI.Model
{
    public class AssignUpdateRequest
    {
        public List<int> SystemIDs { get; set; }  // List of selected SystemIDs
        public int UpdateID { get; set; }
        public string Status { get; set; }
        public string StatusMessage { get; set; }
        public DateTime LastAttemptDate { get; set; }
    }
}
