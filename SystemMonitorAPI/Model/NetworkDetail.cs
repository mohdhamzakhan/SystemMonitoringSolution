using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_NETWORKDETAIL")]
    public class NetworkDetail
    {
        [Column("ID")]
        public int ID { get;set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("INTERFACENAME")]
        public string? InterfaceName { get; set; }
        [Column("IPADDRESS")]
        public string? IPAddress { get; set; }
        [Column("MACADDRESS")]
        public string? MACAddress { get; set; }
        [Column("NETWORKTYPE")]
        public string? NetworkType { get; set; }

    }
}
