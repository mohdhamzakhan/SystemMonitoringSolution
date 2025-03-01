using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_LOCALUSERINFO")]
    public class LocalUserInfo
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("USERNAME")]
        public string? UserName { get; set; }
        [Column("ISENABLED")]
        public bool IsEnabled { get; set; }
        [Column("ISLOCKED")]
        public bool IsLocked { get; set; }
        [Column("DESCRIPTION")]
        public string? Description { get; set; }
    }
}
