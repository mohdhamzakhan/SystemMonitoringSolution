using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    [Table("SMM_MONITORDETAIL")]
    public class MonitorDetail
    {
        [Column("ID")]
        public int ID { get; set; }
        [Column("HOSTNAME")]
        public string? Hostname { get; set; }
        [Column("MANUFACTURER")]
        public string? Manufacturer { get; set; }
        [Column("SERIALNO")]
        public string? SerialNo { get; set; }
        [Column("DISPLAYNAME")]
        public string? DisplayName { get; set; }
        [Column("YEAROFMANUFACTURE")]
        public string? YearOfManufacture { get; set; }
    }
}
