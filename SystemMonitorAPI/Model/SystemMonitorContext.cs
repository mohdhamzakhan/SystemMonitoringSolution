using Microsoft.EntityFrameworkCore;
using SystemMonitorAPI.Models;

namespace SystemMonitorAPI.Model
{
    public class SystemMonitorContext : DbContext
    {
        public SystemMonitorContext(DbContextOptions<SystemMonitorContext> options)
             : base(options)
        {
        }

        public DbSet<Device> Devices { get; set; }
        public DbSet<SystemDetail> SystemDetails { get; set; }
        public DbSet<SoftwareDetail> SoftwareDetails { get; set; }
        public DbSet<DiskDetails> DiskDetails { get; set; }
        public DbSet<DiskInfo> DiskInfo { get; set; }
        public DbSet<LocalUserInfo> LocalUserDetail { get; set; }
        public DbSet<firewallProfileInfo> firewallProfileInfo { get; set; }
        public DbSet<NetworkDetail> NetworkDetail { get; set; }
        public DbSet<PhysicalMemoryInfo> PhysicalMemoryInfo { get; set; }
        public DbSet<antivirusInfos> antivirusInfos { get; set; }
        public DbSet<MonitorDetail> MonitorDetail { get; set; }
        public DbSet<BitLockerKey> BitLockerKey { get; set; }

        public DbSet<BatteryInfo> BatteryInfo { get; set; }
        public DbSet<SystemEventInfo> SystemEvents { get; set; }
        public DbSet<Vulnerability> Vulnerabilities { get; set; }

        #region Switch
        // ── Network scan tables ───────────────────────────────────
        public DbSet<SmmSwitch> Switches { get; set; }
        public DbSet<SmmSwitchPort> SwitchPorts { get; set; }
        public DbSet<SmmSwitchNeighbor> SwitchNeighbors { get; set; }

        #endregion

        #region Installation
        public DbSet<SystemInfo> Systems { get; set; }
        public DbSet<UpdateInfo> Updates { get; set; }
        public DbSet<SystemUpdate> SystemUpdates { get; set; }
        public DbSet<Credential> Credentials { get; set; }
        public DbSet<UpdateLog> UpdateLogs { get; set; }
        #endregion

        #region Uninstallation
        public DbSet<UninstallInfo> uninstallInfos { get; set; }
        #endregion
        
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Device>()
            .HasMany(d => d.SystemDetails)
            .WithOne()
            .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
                .HasMany(d => d.SoftwareDetails)
                .WithOne()
                .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
                .HasMany(d => d.DiskDetails)
                .WithOne()
                .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.diskInfos)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.LocalUserDetails)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.firewallProfileInfo)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.NetworkDetails)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.MonitorDetails)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
              .HasMany(d => d.PhysicalMemoryInfo)
              .WithOne()
              .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<Device>()
                .HasMany(d => d.antivirusInfos)
                .WithOne()
                .HasForeignKey(sd => sd.Hostname);

            modelBuilder.Entity<BatteryInfo>(entity =>
            {
                entity.HasKey(e => e.ID)
                    .HasName("PK_SMM_BATTERYINFO");

                entity.HasOne(e => e.Device)
                    .WithMany(d => d.BatteryInfos)
                    .HasForeignKey(e => e.Hostname)
                    .HasConstraintName("FK_SMM_BATTERYINFO_SMM_DEVICE_HOSTNAME")
                    .OnDelete(DeleteBehavior.Restrict); // NO ACTION
            });

            modelBuilder.Entity<Vulnerability>()
                .HasIndex(v => new { v.CveId, v.SoftwareDetailsID })
                .IsUnique();

            #region switch
            // ── SMM_SWITCH ────────────────────────────────────────
            modelBuilder.Entity<SmmSwitch>(e =>
            {
                e.HasKey(x => x.SwitchId);

                // Unique IP
                e.HasIndex(x => x.IpAddress).IsUnique();

                // Oracle: use sequence for identity (fully qualified)
                OraclePropertyBuilderExtensions.UseHiLo(e.Property(x => x.SwitchId), "SMM_SWITCH_SEQ");

                e.HasMany(x => x.Ports)
                 .WithOne(p => p.Switch)
                 .HasForeignKey(p => p.SwitchId)
                 .OnDelete(DeleteBehavior.Cascade);

                e.HasMany(x => x.NeighborsAsLocal)
                 .WithOne(n => n.LocalSwitch)
                 .HasForeignKey(n => n.LocalSwitchId)
                 .OnDelete(DeleteBehavior.Cascade);
            });

            // ── SMM_SWITCHPORT ────────────────────────────────────
            modelBuilder.Entity<SmmSwitchPort>(e =>
            {
                e.HasKey(x => x.PortId);

                // Oracle: use sequence for identity
                OraclePropertyBuilderExtensions.UseHiLo(e.Property(x => x.PortId), "SMM_SWITCHPORT_SEQ");

                // Unique per switch + ifIndex
                e.HasIndex(x => new { x.SwitchId, x.IfIndex }).IsUnique();
            });

            // ── SMM_SWITCHNEIGHBOR ────────────────────────────────
            modelBuilder.Entity<SmmSwitchNeighbor>(e =>
            {
                e.HasKey(x => x.NeighborId);

                // Oracle: use sequence for identity
                OraclePropertyBuilderExtensions.UseHiLo(e.Property(x => x.NeighborId), "SMM_NEIGHBOR_SEQ");

                // Optional FK: remote switch may not be managed
                e.HasOne(x => x.RemoteSwitch)
                 .WithMany()
                 .HasForeignKey(x => x.RemoteSwitchId)
                 .OnDelete(DeleteBehavior.SetNull)
                 .IsRequired(false);

                e.HasOne(x => x.LocalPort)
                 .WithMany(p => p.Neighbors)
                 .HasForeignKey(x => x.LocalPortId)
                 .OnDelete(DeleteBehavior.SetNull)
                 .IsRequired(false);
            });
            #endregion

            #region Installation
            // Configure the many-to-many relationship between SystemInfo and UpdateInfo

            modelBuilder.Entity<SystemUpdate>()
        .HasOne(su => su.SystemInfo)
        .WithMany(si => si.SystemUpdates)
        .HasForeignKey(su => su.SystemID)
        .OnDelete(DeleteBehavior.Cascade); // Use appropriate behavior

            modelBuilder.Entity<SystemUpdate>()
                .HasOne(su => su.UpdateInfo)
                .WithMany(ui => ui.SystemUpdates)
                .HasForeignKey(su => su.UpdateID)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<UpdateLog>()
                .HasOne(ul => ul.SystemInfo)
                .WithMany()
                .HasForeignKey(ul => ul.SystemID)
                .OnDelete(DeleteBehavior.Restrict); // Use appropriate behavior

            modelBuilder.Entity<UpdateLog>()
                .HasOne(ul => ul.UpdateInfo)
                .WithMany()
                .HasForeignKey(ul => ul.UpdateID)
                .OnDelete(DeleteBehavior.Restrict);

            #endregion
        }
    }
}
