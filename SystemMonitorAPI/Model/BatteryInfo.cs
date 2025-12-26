using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{

    [Table("SMM_BATTERYINFO")]
    public class BatteryInfo
    {
        [Key]
        [Column("ID")]
        public int ID { get; set; }

        [Column("ESTIMATEDCHARGE")]
        public int? EstimatedChargeRemaining { get; set; }

        [Column("BATTERYSTATUS")]
        public string? BatteryStatus { get; set; }

        [Column("DESIGNCAPACITY")]
        public int? DesignCapacity { get; set; }

        [Column("FULLCHARGEDCAPACITY")]
        public int? FullChargedCapacity { get; set; }

        [Column("HOSTNAME")]
        [StringLength(450)]
        public string? Hostname { get; set; }

        [Column("NAME")]
        public string? Name { get; set; }

        // 🔗 Navigation Property
        [ForeignKey(nameof(Hostname))]
        public virtual Device? Device { get; set; }
    }
}
