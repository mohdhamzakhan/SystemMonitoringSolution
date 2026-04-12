using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SystemMonitorAPI.Model
{
    public class DeviceInfo
    {
        // General device information
        public string Hostname { get; set; }
        public string Username { get; set; }
        public string BIOSSerial { get; set; }
        public string ProcessorFamily { get; set; }
        public double MaxPhysical { get; set; }
        public double PhysicalMemory { get; set; }
        public string Make { get; set; }
        public string Model { get; set; }
        public string OSName { get; set; }
        public string OSVersion { get; set; }
        public string Domain { get; set; }
        public string OUName { get; set; }
        public string AgentVersion { get; set; }

        // Installed software list
        public List<SoftwareDetail> InstalledSoftware { get; set; } = new List<SoftwareDetail>();
        public List<DiskDetails> DiskDetails { get; set; } = new List<DiskDetails>();
        public List<antivirusInfos> antivirusInfos { get; set; } = new List<antivirusInfos>();
        public List<DiskInfo> DiskInfo { get; set; } = new List<DiskInfo>();

        public List<LocalUserInfo> LocalUserInfo { get; set; } = new List<LocalUserInfo>();
        //public List<firewallProfileInfo> firewallProfileInfo { get; set; } = new List<firewallProfileInfo>();
        public List<NetworkDetail> NetworkDetails { get; set; } = new List<NetworkDetail>();
        public List<SystemDetail> SystemDetails { get; set; } = new List<SystemDetail>();
        public List<PhysicalMemoryInfo> PhysicalMemoryInfo { get; set; } = new List<PhysicalMemoryInfo>();

        public List<MonitorDetail> MonitorInfos { get; set; } = new List<MonitorDetail>();
        public List<BitLockerKey> BitLockerInfos { get; set; } = new List<BitLockerKey>();
        public List<BatteryInfo> BatteryInfos { get; set; } = new List<BatteryInfo>();

    }



    public class DeviceDto
    {
        public string Hostname { get; set; }
        public string Username { get; set; }
        public string Status { get; set; }
        public DateTime LastUpdated { get; set; }
        public SystemDetailDto SystemDetail { get; set; }
        public List<SoftwareDetailDto> SoftwareDetails { get; set; }
        public List<DiskDetailsdto> DiskDetails { get; set; } = new List<DiskDetailsdto>();
        public List<AntivirusDetaildto> AntivirusDetails { get; set; } = new List<AntivirusDetaildto>();
        public List<DriveDetaildto> DriveDetails { get; set; } = new List<DriveDetaildto>();
        public List<LocalUserDetaildto> LocalUserDetails { get; set; } = new List<LocalUserDetaildto>();
        public List<FirewallDetaildto> FirewallDetail { get; set; } = new List<FirewallDetaildto>();
        public List<NetworkDetaildto> NetworkDetails { get; set; } = new List<NetworkDetaildto>();
        public List<SystemDetail> SystemDetails { get; set; } = new List<SystemDetail>();
        public List<MonitorDetaildto> MonitorDetails { get; set; } = new List<MonitorDetaildto>();
        public List<BitLockerKeydto> bitLockerKeys { get; set; } = new List<BitLockerKeydto>();

        public List<BatteryInfodto> BatteryInfos { get; set; } = new List<BatteryInfodto>();

    }

    public class SystemEventInfodto
    {
        public string Hostname { get; set; }
        public string EventType { get; set; } // Login, Logout, Lock, Unlock, Restart, Shutdown
        public DateTime EventTime { get; set; }
        public string Username { get; set; }
    }

    public class BatteryInfodto
    {
        public string DeviceName { get; set; }
        public string Manufacturer { get; set; }
        public int DesignCapacity { get; set; }
        public int FullChargeCapacity { get; set; }
        public int CycleCount { get; set; }
        public string Status { get; set; }
    }

    public class NetworkDetaildto
    {

        public string InterfaceName { get; set; }
        public string IPAddress { get; set; }
        public string MACAddress { get; set; }
        public string NetworkType { get; set; }

    }
    public class BitLockerKeydto
    {
        public string Hostname { get; set; }
        public string Identifier { get; set; }
        public string PasswordId { get; set; }
        public string RecoveryKey { get; set; }
        public DateTime CreatedAt { get; set; }
    }
    public class MonitorDetaildto
    {
        public string Manufacturer { get; set; }
        public string SerialNo { get; set; }
        public string DisplayName { get; set; }
        public string YearOfManufacture { get; set; }
    }
    public class FirewallDetaildto
    {

        public string Name { get; set; }
        public string Enabled { get; set; }
        public string DefaultInboundAction { get; set; }
        public string DefaultOutboundAction { get; set; }
    }
    public class LocalUserDetaildto
    {

        public string UserName { get; set; }
        public bool IsEnabled { get; set; }
        public bool IsLocked { get; set; }
        public string Description { get; set; }
    }
    public class DriveDetaildto
    {
        public string DiskName { get; set; }
        public string TypeOfDrive { get; set; } // SSD, HDD, etc.
        public string InterfaceType { get; set; } // SATA, NVMe, etc.
        public double Capacity { get; set; } // Capacity in GB
    }
    public class DiskDetailsdto
    {
        public string DiskName { get; set; }
        public double Capacity { get; set; }
        public double FreeSpace { get; set; }
        public string TypeOfDrive { get; set; }
    }

    public class SystemDetailDto
    {
        public string Hostname { get; set; }
        public string Username { get; set; }
        public string BIOSSerial { get; set; }
        public string ProcessorFamily { get; set; }
        public double? MaxPhysical { get; set; }
        public double? PhysicalMemory { get; set; }
        public string Make { get; set; }
        public string Model { get; set; }
        public string OSName { get; set; }
        public string OSVersion { get; set; }
        public string Domain { get; set; }
        public string OUName { get; set; }
        public string ProductId { get; set; }
        public string AgentVersion { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? StartDate { get; set; }

    }

    public class SoftwareDetailDto
    {
        public string SoftwareName { get; set; }
        public string Version { get; set; }
        public string Publisher { get; set; }
        public string UninstallString { get; set; }
        public int SystemScore { get; set; }

        public bool IsSystemSoftware => SystemScore >= 50;
    }

    public class AntivirusDetaildto
    {

        public string DisplayName { get; set; }

        public string ProductState { get; set; }

        public string LastUpdate { get; set; }
    }

}

