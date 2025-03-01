using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_PHYSICALMEMORYINFO")]
    public class PhysicalMemoryInfo
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("DEVICELOCATOR")]
        public string? DeviceLocator { get; set; }
        [Column("MANUFACTURER")]
        public string? Manufacturer { get; set; }
        [Column("SERIALNO")]
        public string? SerialNo { get; set; }
        [Column("CAPACITY")]
        public double Capacity { get; set; } // Capacity in GB
    }
}
