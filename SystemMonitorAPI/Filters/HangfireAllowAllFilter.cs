using Hangfire.Dashboard;

namespace SystemMonitorAPI.Filters
{
    // ⚠️ Only use this in development
    // For production, replace with proper auth check
    public class HangfireAllowAllFilter : IDashboardAuthorizationFilter
    {
        public bool Authorize(DashboardContext context) => true;
    }
}
