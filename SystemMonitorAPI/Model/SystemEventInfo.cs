using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

[Table("SMM_SYSTEMEVENTINFO")]
public class SystemEventInfo
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("ID")]
    public int Id { get; set; }

    [Column("CLIENT_EVENT_ID")]
    public string ClientEventId { get; set; }   // GUID from client

    [Column("HOSTNAME")]
    public string Hostname { get; set; }

    [Column("EVENTTYPE")]
    public string EventType { get; set; }

    [Column("EVENTTIME")]
    public DateTime EventTime { get; set; }

    [Column("USERNAME")]
    public string Username { get; set; }

    [Column("SOURCE")]
    public string Source { get; set; } // Session / System / App

    [Column("CREATED_AT")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
