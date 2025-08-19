using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_BITLOCKERKEY")]
    public class BitLockerKey
    {
        [Key]
        [Column("ID")]
        public int Id { get; set; }

        [Required]
        [Column("HOSTNAME")]
        public string Hostname { get; set; }

        [Required]
        [Column("IDENTIFIER")]
        public string Identifier { get; set; }

        [Column("PASSWORDID")]
        [Required]
        public string PasswordId { get; set; }

        [Required]
        [Column("RECOVERYKEY")]
        public string RecoveryKey { get; set; }
        [Column("CREATEDAT")]

        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }


    public class ComputerInfo
    {
        public string ComputerName { get; set; }
        public string Department { get; set; }
    }
}
