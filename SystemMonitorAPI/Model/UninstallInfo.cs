using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_UNINSTALLINFO")]
    public class UninstallInfo
    {
        [Key]
        [Column("UNINSTALLID")]
        public int uninstallId { get; set; }
        [Column("SYSTEMID")]
        public int systemId { get; set; }
        [Column("APPLICATIONID")]
        public int applicationId { get; set; }
        [Column("HOSTNAME")]
        public string? hostname { get; set; }
        [Column("SOFTWARENAME")]
        public string? softwareName { get; set; }
        [Column("ACTIVE")]
        public int Active { get; set; }
        [Column("UPDATEDATE")]
        public DateTime updateDate { get; set; }
        [Column("REMARKS")]
        public string? Remarks { get; set; }
    }
}
