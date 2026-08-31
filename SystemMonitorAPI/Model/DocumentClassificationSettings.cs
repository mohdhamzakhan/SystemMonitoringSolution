using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    // Single-row (or named-profile) table holding the FileClassificationWatcher config as
    // JSON, so admins change it once here instead of editing appsettings.json on every
    // machine. Kept as one JSON blob rather than individual columns so new settings fields
    // (e.g. a future per-department profile) don't require a migration every time.
    [Table("SMM_DOC_CLASSIFICATION_SETTINGS")]
    public class DocumentClassificationSettings
    {
        [Key]
        [Column("PROFILE_NAME")]
        public string ProfileName { get; set; } = "Global"; // room to support per-dept profiles later

        [Column("CONFIG_JSON")]
        public string ConfigJson { get; set; } = string.Empty;

        [Column("UPDATED_AT")]
        public DateTime UpdatedAt { get; set; } = DateTime.Now;

        [Column("UPDATED_BY")]
        public string? UpdatedBy { get; set; }
    }
}