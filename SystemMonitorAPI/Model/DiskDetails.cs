using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_DISKDETAILS")]
    public class DiskDetails
    {
        [Column("ID")]
        [Key]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("DISKNAME")]
        public string? DiskName { get; set; }
        [Column("CAPACITY")]
        public double Capacity { get; set; }
        [Column("FREESPACE")]
        public double FreeSpace { get; set; }
        [Column("TYPEOFDRIVE")]
        public string? TypeOfDrive { get; set; }
        [Column("ISENCRYPTED")]
        public double isEncrypted { get; set; }
        [Column("ENCRYPTIONKEY")]
        public string? encryptionKey { get; set; }
    }
}
