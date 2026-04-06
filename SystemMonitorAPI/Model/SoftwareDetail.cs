using Microsoft.EntityFrameworkCore.Metadata.Internal;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_SOFTWAREDETAIL")]
    public class SoftwareDetail
    {
        [Column("SOFTWAREDETAILSID")]
        [Key]
        public int SoftwareDetailsID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Required]
        [Column("SOFTWARENAME")]
        public string? SoftwareName { get; set; }
        [Column("VERSION")]
        public string? Version { get; set; }
        [Column("PUBLISHER")]
        public string? Publisher { get; set; }
        [Column("UNINSTALLSTRING")]
        public string? UninstallString { get; set; }

        // 🔥 ADD THIS
        [InverseProperty("SoftwareDetail")]
        public virtual ICollection<Vulnerability> Vulnerabilities { get; set; } = new List<Vulnerability>();
    }
}
