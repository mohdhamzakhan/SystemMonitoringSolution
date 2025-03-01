using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_ANTIVIRUSINFOS")]
    public class antivirusInfos
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("DISPLAYNAME")]

        public string? DisplayName { get; set; }
        [Column("PRODUCTSTATE")]

        public string? ProductState { get; set; }
        [Column("LASTUPDATE")]

        public string? LastUpdate { get; set; }
    }
}
