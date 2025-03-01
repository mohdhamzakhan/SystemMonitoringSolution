using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

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

    }
}
