namespace SystemMonitorAPI.Model
{
    public interface IUpdateService
    {
        Task<UpdateInfo> SubmitUpdateInfoAsync(UpdateInfo updateInfo);
        Task<List<SystemInfo>> GetActiveHostsAsync();
        Task<bool> AssignUpdateAsync(UpdateAssignmentRequest assignment);
        Task<List<UpdateInfo>> GetActiveUpdatesAsync();
        Task<List<SystemUpdate>> GetAssignedSystemsAsync(int updateId);
    }
}
