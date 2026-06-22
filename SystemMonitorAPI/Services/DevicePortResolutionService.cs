using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Model;
using SystemMonitorAPI.Models;

namespace SystemMonitorAPI.Services
{
    public interface IDevicePortResolutionService
    {
        /// <summary>Resolve switch+port for all known devices.</summary>
        Task<DevicePortResolutionResult> ResolveAllAsync(CancellationToken ct = default);

        /// <summary>Resolve switch+port for a single device hostname.</summary>
        Task<DevicePortResolutionResult> ResolveDeviceAsync(string hostname, CancellationToken ct = default);
    }

    public class DevicePortResolutionService : IDevicePortResolutionService
    {
        private readonly IDbContextFactory<SystemMonitorContext> _dbFactory;
        private readonly ILogger<DevicePortResolutionService> _logger;

        public DevicePortResolutionService(
            IDbContextFactory<SystemMonitorContext> dbFactory,
            ILogger<DevicePortResolutionService> logger)
        {
            _dbFactory = dbFactory;
            _logger = logger;
        }

        public async Task<DevicePortResolutionResult> ResolveAllAsync(CancellationToken ct = default)
        {
            await using var db = await _dbFactory.CreateDbContextAsync(ct);

            var devices = await db.Devices.ToListAsync(ct);
            var neighbors = await db.SwitchNeighbors
                .Include(n => n.LocalSwitch)
                .ToListAsync(ct);

            var result = new DevicePortResolutionResult();

            foreach (var device in devices)
            {
                if (string.IsNullOrWhiteSpace(device.Hostname))
                    continue;
                if (device.Hostname == "PROD-L1-SP")
                {

                }
                var matched = TryMatch(device, neighbors);

                if (matched)
                {
                    db.Entry(device).State = EntityState.Modified;
                    result.Resolved++;
                }
                else
                {
                    result.Unresolved++;
                }
            }

            db.ChangeTracker.DetectChanges();
            await db.SaveChangesAsync(ct);

            _logger.LogInformation(
                "Device port resolution: {Resolved} resolved, {Unresolved} unresolved",
                result.Resolved, result.Unresolved);

            return result;
        }

        public async Task<DevicePortResolutionResult> ResolveDeviceAsync(
    string hostname, CancellationToken ct = default)
        {
            await using var db = await _dbFactory.CreateDbContextAsync(ct);

            var device = await db.Devices
                .FirstOrDefaultAsync(d => d.Hostname == hostname, ct);

            if (device == null)
                return new DevicePortResolutionResult
                {
                    Error = $"Device '{hostname}' not found."
                };

            var neighbors = await db.SwitchNeighbors
                .Include(n => n.LocalSwitch)
                .ToListAsync(ct);

            var result = new DevicePortResolutionResult();

            TryMatch(device, neighbors);

            await db.SaveChangesAsync(ct);

            if (!string.IsNullOrEmpty(device.ConnectedSwitchName))
                result.Resolved++;
            else
                result.Unresolved++;

            return result;
        }

        // ── Core matching logic ───────────────────────────────────────────────
        // Matches a device hostname against neighbor RemoteSysName using
        // three tiers so partial hostnames and FQDNs both resolve correctly.

        private bool TryMatch(Device device, List<SmmSwitchNeighbor> neighbors)
        {
            var hostname = device.Hostname!.Trim();
            var shortName = hostname.Split('.')[0];   // strip domain if FQDN

            // Tier 1 — exact match
            var match =
                neighbors.FirstOrDefault(n =>
                    !string.IsNullOrEmpty(n.RemoteSysName) &&
                    n.RemoteSysName.Equals(hostname, StringComparison.OrdinalIgnoreCase))

                // Tier 2 — short name match (handles FQDN in either direction)
                ?? neighbors.FirstOrDefault(n =>
                    !string.IsNullOrEmpty(n.RemoteSysName) &&
                    (n.RemoteSysName.Split('.')[0]
                        .Equals(shortName, StringComparison.OrdinalIgnoreCase)
                    || shortName.Equals(
                        n.RemoteSysName.Split('.')[0],
                        StringComparison.OrdinalIgnoreCase)))

                // Tier 3 — contains match (catches truncated CDP device IDs)
                ?? neighbors.FirstOrDefault(n =>
                    !string.IsNullOrEmpty(n.RemoteSysName) &&
                    shortName.Length >= 6 &&   // avoid false positives on short names
                    (n.RemoteSysName.Contains(shortName, StringComparison.OrdinalIgnoreCase)
                    || shortName.Contains(
                        n.RemoteSysName.Split('.')[0],
                        StringComparison.OrdinalIgnoreCase)));

            if (match == null)
            {
                _logger.LogDebug("No switch match found for device '{Hostname}'", hostname);
                return false;
            }

            // Write switch + port info back to device
            device.ConnectedSwitchId = match.LocalSwitchId;
            device.ConnectedSwitchName = match.LocalSwitch?.Hostname ?? match.LocalSwitch?.IpAddress;
            device.ConnectedSwitchIp = match.LocalSwitch?.IpAddress;
            device.ConnectedPort = match.LocalPortName;
            device.ConnectionProtocol = match.Protocol;
            device.PortLastSeen = match.LastSeen;

            _logger.LogInformation(
                "Device '{Hostname}' → switch '{Switch}' port '{Port}' ({Protocol})",
                hostname,
                device.ConnectedSwitchName,
                device.ConnectedPort,
                device.ConnectionProtocol);

            return true;
        }
    }

    public class DevicePortResolutionResult
    {
        public int Resolved { get; set; }
        public int Unresolved { get; set; }
        public string? Error { get; set; }
    }
}