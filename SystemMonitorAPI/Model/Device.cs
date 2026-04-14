using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SystemMonitorAPI.Models;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_DEVICE")]
    public class Device
    {
        [Column("HOSTNAME")]
        [Key]
        public string? Hostname { get; set; }
        [Column("USERNAME")]
        public string? Username { get; set; }
        [Column("STATUS")]
        public string? Status { get; set; }
        [Column("LASTUPDATED")]
        public DateTime LastUpdated { get; set; }
        [Column("DEPARTMENT")]
        public string? Department { get; set; }
        [Column("AGENTVERSION")]
        public string? AgentVersion { get; set; }

        // ── NEW: Switch port location ─────────────────────────────────────────
        [Column("CONNECTED_SWITCH_ID")]
        public int? ConnectedSwitchId { get; set; }

        [Column("CONNECTED_SWITCH_NAME")]
        public string? ConnectedSwitchName { get; set; }

        [Column("CONNECTED_SWITCH_IP")]
        public string? ConnectedSwitchIp { get; set; }

        [Column("CONNECTED_PORT")]
        public string? ConnectedPort { get; set; }

        [Column("CONNECTION_PROTOCOL")]
        public string? ConnectionProtocol { get; set; }

        [Column("PORT_LAST_SEEN")]
        public DateTime? PortLastSeen { get; set; }

        // Navigation property to the switch (optional, for joins)
        [ForeignKey("ConnectedSwitchId")]
        public virtual SmmSwitch? ConnectedSwitch { get; set; }

        public virtual ICollection<SystemDetail> SystemDetails { get; set; }
        public virtual ICollection<SoftwareDetail> SoftwareDetails { get; set; }
        public virtual ICollection<DiskDetails> DiskDetails { get; set; }
        public virtual ICollection<DiskInfo> diskInfos { get; set; }
        public virtual ICollection<LocalUserInfo> LocalUserDetails { get; set; }
        public virtual ICollection<NetworkDetail> NetworkDetails { get; set; }
        public virtual ICollection<firewallProfileInfo> firewallProfileInfo { get; set; }
        public virtual ICollection<PhysicalMemoryInfo> PhysicalMemoryInfo { get; set; }
        public virtual ICollection<antivirusInfos> antivirusInfos { get; set; }

        public virtual ICollection<MonitorDetail> MonitorDetails { get; set; }
        public virtual ICollection<BatteryInfo> BatteryInfos { get; set; }
    = new List<BatteryInfo>();


    }
}
