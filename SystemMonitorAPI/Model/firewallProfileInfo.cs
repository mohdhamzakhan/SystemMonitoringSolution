using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_FIREWALLPROFILEINFO")]
    public class firewallProfileInfo
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("NAME")]
        public string? Name { get; set; }
        [Column("ENABLED")]
        public string? Enabled { get; set; }
        [Column("DEFAULTINBOUNDACTION")]
        public string? DefaultInboundAction { get; set; }
        [Column("DEFAULTOUTBOUNDACTION")]
        public string? DefaultOutboundAction { get; set; }
    }
}
