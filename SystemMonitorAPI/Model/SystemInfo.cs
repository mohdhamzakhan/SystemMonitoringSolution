using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_SYSTEMINFO")]
    public class SystemInfo
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("SYSTEMID")]
        public int SystemID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("ISACTIVE")]
        public bool IsActive { get; set; } = true;
        [Column("LASTUPDATEDATE")]
        public DateTime? LastUpdateDate { get; set; }

        // Navigation property for SystemUpdate (many-to-many)
        public virtual ICollection<SystemUpdate> SystemUpdates { get; set; }
    }

    [Table("SMM_UPDATEINFO")]
    public  class UpdateInfo
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("UPDATEID")]
        public int UpdateID { get; set; }
        [Column("UPDATENAME")]
        public string? UpdateName { get; set; }
        [Column("FILEPATH")]
        public string? FilePath { get; set; }
        [Column("FILENAME")]
        public string? FileName { get; set; }
        [Column("PARAMETERS")]
        public string? Parameters { get; set; }
        [Column("CREATEDDATE")]
        public DateTime CreatedDate { get; set; } = DateTime.Now;
        [Column("ISACTIVE")]
        public bool IsActive { get; set; } = true;
        [Column("ISLOCAL")]
        public bool IsLocal { get; set; } = false;

        // Navigation property for SystemUpdate (many-to-many)
        public virtual ICollection<SystemUpdate> SystemUpdates { get; set; }
    }

    [Table("SMM_SYSTEMUPDATE")]
    public class SystemUpdate
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("SYSTEMUPDATEID")]
        public int SystemUpdateID { get; set; }
        [Column("SYSTEMID")]
        public int SystemID { get; set; }
        [Column("UPDATEID")]
        public int UpdateID { get; set; }
        [Column("STATUS")]
        public string? Status { get; set; } // e.g., Pending, Success, Failed
        [Column("STATUSMESSAGE")]
        public string? StatusMessage { get; set; }
        [Column("LASTATTEMPTDATE")]
        public DateTime? LastAttemptDate { get; set; }

        // Navigation properties
        public virtual SystemInfo SystemInfo { get; set; }
        public virtual UpdateInfo UpdateInfo { get; set; }
    }

    [Table("SMM_CREDENTIAL")]
    public class Credential
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("CREDENTIALID")]
        public int CredentialID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("USERNAME")]
        public string? Username { get; set; }
        [Column("ENCRYPTEDPASSWORD")]
        public string? EncryptedPassword { get; set; } // Store encrypted passwords
    }

    [Table("SMM_UPDATELOG")]
    public class UpdateLog
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("LOGID")]
        public int LogID { get; set; }
        [Column("SYSTEMID")]
        public int SystemID { get; set; }
        [Column("UPDATEID")]
        public int UpdateID { get; set; }
        [Column("LOGMESSAGE")]
        public string? LogMessage { get; set; }
        [Column("LOGDATE")]
        public DateTime LogDate { get; set; } = DateTime.Now;

        // Navigation properties
        public virtual SystemInfo SystemInfo { get; set; }
        public virtual UpdateInfo UpdateInfo { get; set; }
    }
}