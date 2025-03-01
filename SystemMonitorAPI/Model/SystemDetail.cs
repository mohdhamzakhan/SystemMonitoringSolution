    using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_SYSTEMDETAIL")]
    public class SystemDetail
    {
        [Column("HOSTNAME")]
        [Key]
        public string? Hostname { get; set; }
        [Column("USERNAME")]
        public string? Username { get; set; }
        [Column("BIOSSERIAL")]
        public string? BIOSSerial { get; set; }
        [Column("PROCESSORFAMILY")]
        public string? ProcessorFamily { get; set; }
        [Column("MAXPHYSICAL")]
        public double MaxPhysical { get; set; }
        [Column("PHYSICALMEMORY")]
        public double PhysicalMemory { get; set; }
        [Column("MAKE")]
        public string? Make { get; set; }
        [Column("MODEL")]
        public string? Model { get; set; }
        [Column("OSNAME")]
        public string? OSName { get; set; }
        [Column("OSVERSION")]
        public string? OSVersion { get; set; }
        [Column("DOMAIN")]
        public string? Domain { get; set; }
        [Column("OUNAME")]
        public string? OUName { get; set; }


    }
}
