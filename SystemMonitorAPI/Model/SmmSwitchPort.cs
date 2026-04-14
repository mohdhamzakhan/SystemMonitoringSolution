using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Models
{
    [Table("SMM_SWITCHPORT")]
    public class SmmSwitchPort
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("PORTID")]
        public int PortId { get; set; }

        [Column("SWITCHID")]
        public int SwitchId { get; set; }

        /// <summary>
        /// SNMP ifIndex (1.3.6.1.2.1.2.2.1.1)
        /// </summary>
        [Column("IFINDEX")]
        public int IfIndex { get; set; }

        /// <summary>
        /// Port name from ifDescr (1.3.6.1.2.1.2.2.1.2)
        /// e.g. GigabitEthernet0/1, FastEthernet1/0/1
        /// </summary>
        [Column("PORTNAME")]
        [MaxLength(100)]
        public string? PortName { get; set; }

        /// <summary>
        /// Short/alias port name from ifAlias (1.3.6.1.2.1.31.1.1.1.18)
        /// </summary>
        [Column("PORTALIAS")]
        [MaxLength(100)]
        public string? PortAlias { get; set; }

        /// <summary>
        /// Interface type code (ifType): 6=ethernetCsmacd, 161=ieee8023adLag
        /// </summary>
        [Column("IFTYPE")]
        public int? IfType { get; set; }

        /// <summary>
        /// Port MAC address from ifPhysAddress (1.3.6.1.2.1.2.2.1.6)
        /// </summary>
        [Column("MACADDRESS")]
        [MaxLength(20)]
        public string? MacAddress { get; set; }

        /// <summary>
        /// Speed in bps from ifSpeed (1.3.6.1.2.1.2.2.1.5)
        /// Use ifHighSpeed for >100Mbps
        /// </summary>
        [Column("SPEEDMBPS")]
        public long? SpeedMbps { get; set; }

        /// <summary>
        /// Admin status: 1=up, 2=down, 3=testing
        /// </summary>
        [Column("ADMINSTATUS")]
        public int? AdminStatus { get; set; }

        /// <summary>
        /// Oper status: 1=up, 2=down
        /// </summary>
        [Column("OPERSTATUS")]
        public int? OperStatus { get; set; }

        /// <summary>
        /// IP address assigned to this port (for L3 routed ports)
        /// </summary>
        [Column("PORTIP")]
        [MaxLength(45)]
        public string? PortIp { get; set; }

        /// <summary>
        /// VLAN ID (for access ports)
        /// </summary>
        [Column("VLANID")]
        public int? VlanId { get; set; }

        /// <summary>
        /// Whether this is an uplink port (has neighbor via LLDP/CDP)
        /// </summary>
        [Column("ISUPLINK")]
        public bool IsUplink { get; set; } = false;

        [Column("LASTUPDATED")]
        public DateTime? LastUpdated { get; set; }

        // Navigation
        [ForeignKey("SwitchId")]
        public virtual SmmSwitch? Switch { get; set; }
        public virtual ICollection<SmmSwitchNeighbor> Neighbors { get; set; } = new List<SmmSwitchNeighbor>();
    }
}