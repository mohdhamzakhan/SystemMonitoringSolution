using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Jobs
{
    public class CveLocalRefreshJob
    {
        private readonly ICveLocalService _svc;

        public CveLocalRefreshJob(ICveLocalService svc)
        {
            _svc = svc;
        }

        public async Task RunAsync()
        {
            await _svc.RefreshDatabaseAsync();
        }
    }
}