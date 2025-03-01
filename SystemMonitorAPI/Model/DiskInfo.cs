using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_DISKINFO")]
    public class DiskInfo
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("DISKNAME")]
        public string? DiskName { get; set; }
        [Column("TYPEOFDRIVE")]
        public string? TypeOfDrive { get; set; } // SSD, HDD, etc.
        [Column("INTERFACETYPE")]
        public string? InterfaceType { get; set; } // SATA, NVMe, etc.
        [Column("CAPACITY")]
        public double Capacity { get; set; } // Capacity in GB
    }
}
