using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Models
{
    /// <summary>
    /// Stores topology links discovered via LLDP or CDP.
    /// Each row = one directional link: LocalSwitch:LocalPort → RemoteSwitch:RemotePort
    /// </summary>
    [Table("SMM_SWITCHNEIGHBOR")]
    public class SmmSwitchNeighbor
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("NEIGHBORID")]
        public int NeighborId { get; set; }

        /// <summary>
        /// Local switch (the one we queried)
        /// </summary>
        [Column("LOCALSWITCHID")]
        public int LocalSwitchId { get; set; }

        /// <summary>
        /// Local port IfIndex on the local switch
        /// </summary>
        [Column("LOCALPORTID")]
        public int? LocalPortId { get; set; }

        /// <summary>
        /// Local port name (e.g. GigabitEthernet1/0/1)
        /// </summary>
        [Column("LOCALPORTNAME")]
        [MaxLength(100)]
        public string? LocalPortName { get; set; }

        /// <summary>
        /// Remote switch ID if it's also managed and in our DB
        /// </summary>
        [Column("REMOTESWITCHID")]
        public int? RemoteSwitchId { get; set; }

        /// <summary>
        /// Remote system name from LLDP/CDP
        /// </summary>
        [Column("REMOTESYSNAME")]
        [MaxLength(255)]
        public string? RemoteSysName { get; set; }

        /// <summary>
        /// Remote IP address from LLDP/CDP
        /// </summary>
        [Column("REMOTEIP")]
        [MaxLength(45)]
        public string? RemoteIp { get; set; }

        /// <summary>
        /// Remote port description from LLDP/CDP
        /// </summary>
        [Column("REMOTEPORTNAME")]
        [MaxLength(100)]
        public string? RemotePortName { get; set; }

        /// <summary>
        /// Remote chassis ID (usually MAC address)
        /// </summary>
        [Column("REMOTECHASSISID")]
        [MaxLength(50)]
        public string? RemoteChassisId { get; set; }

        /// <summary>
        /// Discovery protocol used: LLDP or CDP
        /// </summary>
        [Column("PROTOCOL")]
        [MaxLength(10)]
        public string? Protocol { get; set; }

        [Column("LASTSEEN")]
        public DateTime? LastSeen { get; set; }

        // Navigation
        [ForeignKey("LocalSwitchId")]
        public virtual SmmSwitch? LocalSwitch { get; set; }

        [ForeignKey("LocalPortId")]
        public virtual SmmSwitchPort? LocalPort { get; set; }

        [ForeignKey("RemoteSwitchId")]
        public virtual SmmSwitch? RemoteSwitch { get; set; }
    }
}