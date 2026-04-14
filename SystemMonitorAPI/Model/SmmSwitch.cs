using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Models
{
    [Table("SMM_SWITCH")]
    public class SmmSwitch
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("SWITCHID")]
        public int SwitchId { get; set; }

        /// <summary>
        /// IP address used to reach this switch
        /// </summary>
        [Column("IPADDRESS")]
        [MaxLength(45)]
        public string? IpAddress { get; set; }

        /// <summary>
        /// Hostname from SNMP sysName (1.3.6.1.2.1.1.5.0)
        /// </summary>
        [Column("HOSTNAME")]
        [MaxLength(255)]
        public string? Hostname { get; set; }

        /// <summary>
        /// Full description from SNMP sysDescr (1.3.6.1.2.1.1.1.0)
        /// e.g. "Cisco IOS Software..." or "HP Aruba..."
        /// </summary>
        [Column("SYSDESCR")]
        [MaxLength(1024)]
        public string? SysDescr { get; set; }

        /// <summary>
        /// Detected vendor: Cisco, HP, Aruba, Unknown
        /// </summary>
        [Column("VENDOR")]
        [MaxLength(50)]
        public string? Vendor { get; set; }

        /// <summary>
        /// Detected model number
        /// </summary>
        [Column("MODEL")]
        [MaxLength(100)]
        public string? Model { get; set; }

        /// <summary>
        /// Switch layer: L2 or L3
        /// </summary>
        [Column("SWITCHLAYER")]
        [MaxLength(10)]
        public string? SwitchLayer { get; set; }

        /// <summary>
        /// MAC address of the switch (from ifPhysAddress of management interface)
        /// </summary>
        [Column("MACADDRESS")]
        [MaxLength(20)]
        public string? MacAddress { get; set; }

        /// <summary>
        /// Firmware / software version
        /// </summary>
        [Column("FIRMWAREVERSION")]
        [MaxLength(255)]
        public string? FirmwareVersion { get; set; }

        /// <summary>
        /// sysLocation (1.3.6.1.2.1.1.6.0)
        /// </summary>
        [Column("LOCATION")]
        [MaxLength(255)]
        public string? Location { get; set; }

        /// <summary>
        /// sysContact (1.3.6.1.2.1.1.4.0)
        /// </summary>
        [Column("CONTACT")]
        [MaxLength(255)]
        public string? Contact { get; set; }

        /// <summary>
        /// sysUpTime in seconds
        /// </summary>
        [Column("UPTIME")]
        public long? UptimeSeconds { get; set; }

        /// <summary>
        /// IP pool name this switch was discovered from
        /// </summary>
        [Column("POOLNAME")]
        [MaxLength(100)]
        public string? PoolName { get; set; }

        /// <summary>
        /// Whether SNMP responded during last scan
        /// </summary>
        [Column("ISREACHABLE")]
        public bool IsReachable { get; set; } = true;

        [Column("ISACTIVE")]
        public bool IsActive { get; set; } = true;

        [Column("FIRSTDISCOVERED")]
        public DateTime? FirstDiscovered { get; set; }

        [Column("LASTSCANDATE")]
        public DateTime? LastScanDate { get; set; }

        // Navigation properties
        public virtual ICollection<SmmSwitchPort> Ports { get; set; } = new List<SmmSwitchPort>();
        public virtual ICollection<SmmSwitchNeighbor> NeighborsAsLocal { get; set; } = new List<SmmSwitchNeighbor>();
    }
}