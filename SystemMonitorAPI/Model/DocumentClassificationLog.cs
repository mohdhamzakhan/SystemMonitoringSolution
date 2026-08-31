using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    // One row per classification event (created / opened-unclassified / confirmed-on-close /
    // changed-on-close) coming from the Word / Excel / PowerPoint add-ins.
    [Table("SMM_DOC_CLASSIFICATION")]
    public class DocumentClassificationLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("ID")]
        public int Id { get; set; }

        // GUID generated client-side so a retried post (after the API/network was briefly
        // down) never creates a duplicate row.
        [Column("CLIENT_EVENT_ID")]
        public string ClientEventId { get; set; } = string.Empty;

        [Column("HOSTNAME")]
        public string Hostname { get; set; } = string.Empty;

        [Column("USERNAME")]
        public string Username { get; set; } = string.Empty;

        // "Word" | "Excel" | "PowerPoint"
        [Column("APPLICATION")]
        public string Application { get; set; } = string.Empty;

        [Column("DOCUMENT_NAME")]
        public string DocumentName { get; set; } = string.Empty;

        [Column("DOCUMENT_PATH")]
        public string? DocumentPath { get; set; }

        // Stable ID (a GUID we stamp into a custom document property) so the same file can be
        // tracked across renames/moves/saves-as.
        [Column("DOCUMENT_GUID")]
        public string? DocumentGuid { get; set; }

        // "Created" | "OpenedUnclassified" | "ConfirmedOnClose" | "ChangedOnClose"
        [Column("ACTION_TYPE")]
        public string ActionType { get; set; } = string.Empty;

        [Column("PREVIOUS_CLASSIFICATION")]
        public string? PreviousClassification { get; set; }

        // "TopSecret" | "Secret" | "Confidential" | "Public"
        [Column("CLASSIFICATION")]
        public string Classification { get; set; } = string.Empty;

        [Column("EVENT_TIME")]
        public DateTime EventTime { get; set; }

        [Column("CREATED_AT")]
        public DateTime CreatedAt { get; set; } = DateTime.Now;
    }
}