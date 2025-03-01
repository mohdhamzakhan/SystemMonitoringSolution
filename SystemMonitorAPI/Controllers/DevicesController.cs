using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Runtime.Intrinsics.X86;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DevicesController : ControllerBase
    {
        private readonly SystemMonitorContext _context;
        private readonly IHubContext<DeviceHub> _hubContext;

        public DevicesController(SystemMonitorContext context, IHubContext<DeviceHub> hubContext)
        {
            _context = context;
            _hubContext = hubContext;
        }
        [HttpPost]
        public async Task<IActionResult> RegisterDevice([FromBody] DeviceInfo deviceInfo)
        {
            // Check if the device exists
            var existingDevice = await _context.Devices
                .FirstOrDefaultAsync(d => d.Hostname == deviceInfo.Hostname);

            if (existingDevice == null)
            {
                // Create a new device
                existingDevice = new Device
                {
                    Hostname = deviceInfo.Hostname,
                    Username = deviceInfo.Username,
                    Status = "Connected",
                    LastUpdated = DateTime.Now
                };
                _context.Devices.Add(existingDevice);
                await _context.SaveChangesAsync();
            }
            else
            {
                existingDevice.Status = "Connected";
                existingDevice.LastUpdated = DateTime.Now;
            }

            // Add or update system details
            var existingSystemDetail = await _context.SystemDetails
                .FirstOrDefaultAsync(s => s.Hostname == existingDevice.Hostname);

            if (existingSystemDetail == null)
            {
                var systemDetail = new SystemDetail
                {
                    Hostname = existingDevice.Hostname,
                    BIOSSerial = deviceInfo.BIOSSerial,
                    ProcessorFamily = deviceInfo.ProcessorFamily,
                    PhysicalMemory = deviceInfo.PhysicalMemory,
                    Domain = deviceInfo.Domain,
                    Make = deviceInfo.Make,
                    MaxPhysical = deviceInfo.MaxPhysical,
                    Model = deviceInfo.Model,
                    OUName = deviceInfo.OUName,
                    Username = deviceInfo.Username,
                    OSName = deviceInfo.OSName,
                    OSVersion = deviceInfo.OSVersion
                };
                _context.SystemDetails.Add(systemDetail);

                var systemDetailForInstallation = new SystemInfo
                {
                    Hostname = existingDevice.Hostname,
                    IsActive = true
                };

                _context.Systems.Add(systemDetailForInstallation);
            }
            else
            {
                existingSystemDetail.BIOSSerial = deviceInfo.BIOSSerial;
                existingSystemDetail.ProcessorFamily = deviceInfo.ProcessorFamily;
                existingSystemDetail.PhysicalMemory = deviceInfo.PhysicalMemory;
                existingSystemDetail.Domain = deviceInfo.Domain;
                existingSystemDetail.Make = deviceInfo.Make;
                existingSystemDetail.MaxPhysical = deviceInfo.MaxPhysical;
                existingSystemDetail.Model = deviceInfo.Model;
                existingSystemDetail.OUName = deviceInfo.OUName;
                existingSystemDetail.Username = deviceInfo.Username;
                existingSystemDetail.OSName = deviceInfo.OSName;
                existingSystemDetail.OSVersion = deviceInfo.OSVersion;
            }

            // Add or update software details
            var existingSoftwareDetails = _context.SoftwareDetails
                .Where(s => s.Hostname == existingDevice.Hostname);

            //_context.SoftwareDetails.RemoveRange(existingSoftwareDetails); // Remove old entries
            //foreach (var software in deviceInfo.InstalledSoftware)
            //{
            //    _context.SoftwareDetails.Add(new SoftwareDetail
            //    {
            //        Hostname = existingDevice.Hostname,
            //        SoftwareName = software.SoftwareName,
            //        Version = software.Version,
            //        Publisher = software.Publisher
            //    });
            //}

            foreach (var software in deviceInfo.InstalledSoftware)
            {
                // Check if a record with the same Hostname, DiskName, and TypeOfDrive already exists
                var existingSoftware = _context.SoftwareDetails.FirstOrDefault(d =>
                    d.Hostname == existingDevice.Hostname &&
                    d.SoftwareName == software.SoftwareName &&
                    d.Publisher == software.Publisher);

                if (existingSoftware != null)
                {
                    // Update the existing record
                    existingSoftware.Version = software.Version;
                    existingSoftware.UninstallString = software.UninstallString;
                }
                else
                {
                    // Add a new record if it doesn't exist
                    _context.SoftwareDetails.Add(new SoftwareDetail
                    {
                        Hostname = existingDevice.Hostname,
                        SoftwareName = software.SoftwareName,
                        Publisher = software.Publisher,
                        Version = software.Version,
                        UninstallString = software.UninstallString
                    });
                }
            }

            var softwareDetails = deviceInfo.InstalledSoftware.Select(d => d.SoftwareName).ToList();

            var softwareDatabase = await _context.SoftwareDetails
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var softwareToDelete = softwareDatabase
                .Where(d => !softwareDetails.Contains(d.SoftwareName))
                .ToList();

            if (softwareToDelete.Any())
            {
                _context.SoftwareDetails.RemoveRange(softwareToDelete);
                await updateSoftwareUninstallStatus(softwareToDelete);
            }


            foreach (var disk in deviceInfo.DiskDetails)
            {
                // Check if a record with the same Hostname, DiskName, and TypeOfDrive already exists
                var existingDisk = _context.DiskDetails.FirstOrDefault(d =>
                    d.Hostname == existingDevice.Hostname &&
                    d.DiskName == disk.DiskName &&
                    d.TypeOfDrive == disk.TypeOfDrive);

                if (existingDisk != null)
                {
                    // Update the existing record
                    existingDisk.Capacity = disk.Capacity;
                    existingDisk.FreeSpace = disk.FreeSpace;
                    existingDisk.isEncrypted = disk.isEncrypted;
                    existingDisk.encryptionKey = disk.encryptionKey;
                }
                else
                {
                    // Add a new record if it doesn't exist
                    _context.DiskDetails.Add(new DiskDetails
                    {
                        Hostname = existingDevice.Hostname,
                        Capacity = disk.Capacity,
                        DiskName = disk.DiskName,
                        FreeSpace = disk.FreeSpace,
                        TypeOfDrive = disk.TypeOfDrive,
                        isEncrypted = disk.isEncrypted,
                        encryptionKey = disk.encryptionKey
                    });
                }
            }
            var currentDiskDetails = deviceInfo.DiskDetails.Select(d => d.DiskName).ToList();

            var disksInDiskDetailsDatabase = await _context.DiskDetails
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var diskDetailsToDelete = disksInDiskDetailsDatabase
                .Where(d => !currentDiskDetails.Contains(d.DiskName))
                .ToList();

            if (diskDetailsToDelete.Any())
            {
                _context.DiskDetails.RemoveRange(diskDetailsToDelete);
            }


            foreach (var drive in deviceInfo.DiskInfo)
            {
                var existingDrive = _context.DiskInfo.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.DiskName == drive.DiskName
                );

                if (existingDrive != null)
                {
                    continue;
                }
                else
                {
                    _context.DiskInfo.Add(new DiskInfo
                    {
                        Hostname = existingDevice.Hostname,
                        Capacity = drive.Capacity,
                        DiskName = drive.DiskName,
                        InterfaceType = drive.InterfaceType,
                        TypeOfDrive = drive.TypeOfDrive
                    });
                }
            }

            var currentDiskInfo = deviceInfo.DiskInfo.Select(d => d.DiskName).ToList();

            var disksInDiskInfoDatabase = await _context.DiskInfo
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var disksInfoToDelete = disksInDiskInfoDatabase
                .Where(d => !currentDiskInfo.Contains(d.DiskName))
                .ToList();

            if (disksInfoToDelete.Any())
            {
                _context.DiskInfo.RemoveRange(disksInfoToDelete);
            }

            //foreach (var firewall in deviceInfo.firewallProfileInfo)
            //{
            //    var exisitingFirewall = _context.firewallProfileInfo.FirstOrDefault(d =>
            //    d.Hostname == existingDevice.Hostname &&
            //    d.Name == firewall.Name
            //    );

            //    if (exisitingFirewall != null)
            //    {
            //        exisitingFirewall.DefaultOutboundAction = firewall.DefaultOutboundAction;
            //        exisitingFirewall.Enabled = firewall.Enabled;
            //        exisitingFirewall.DefaultInboundAction = firewall.DefaultInboundAction;
            //    }
            //    else
            //    {
            //        _context.firewallProfileInfo.Add(new firewallProfileInfo
            //        {
            //            Hostname = existingDevice.Hostname,
            //            DefaultInboundAction = firewall.DefaultInboundAction,
            //            DefaultOutboundAction = firewall.DefaultOutboundAction,
            //            Enabled = firewall.Enabled,
            //            Name = firewall.Name
            //        });
            //    }
            //}



            foreach (var localUser in deviceInfo.LocalUserInfo)
            {
                var exisitingLocalUser = _context.LocalUserDetail.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.UserName == localUser.UserName
                );

                if (exisitingLocalUser != null)
                {
                    exisitingLocalUser.UserName = localUser.UserName;
                    exisitingLocalUser.IsLocked = localUser.IsLocked;
                    exisitingLocalUser.IsEnabled = localUser.IsEnabled;
                    exisitingLocalUser.Description = localUser.Description;
                }
                else
                {
                    _context.LocalUserDetail.Add(new LocalUserInfo
                    {
                        Hostname = existingDevice.Hostname,
                        Description = localUser.Description,
                        IsEnabled = localUser.IsEnabled,
                        IsLocked = localUser.IsLocked,
                        UserName = localUser.UserName
                    });
                }
            }

            var currentlocalUser = deviceInfo.LocalUserInfo.Select(d => d.UserName).ToList();

            var localUserDatabase = await _context.LocalUserDetail
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var localUserToDelete = localUserDatabase
                .Where(d => !currentlocalUser.Contains(d.UserName))
                .ToList();

            if (localUserToDelete.Any())
            {
                _context.LocalUserDetail.RemoveRange(localUserToDelete);
            }

            foreach (var monitor in deviceInfo.MonitorInfos)
            {
                var exisitingMonitor = _context.MonitorDetail.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.SerialNo == monitor.SerialNo);

                if (exisitingMonitor != null)
                {
                    exisitingMonitor.Manufacturer = monitor.Manufacturer;
                    exisitingMonitor.YearOfManufacture = monitor.YearOfManufacture;
                    exisitingMonitor.SerialNo = monitor.SerialNo;
                }
                else
                {
                    _context.MonitorDetail.Add(new MonitorDetail
                    {
                        Hostname = existingDevice.Hostname,
                        DisplayName = monitor.DisplayName,
                        Manufacturer = monitor.Manufacturer,
                        SerialNo = monitor.SerialNo,
                        YearOfManufacture = monitor.YearOfManufacture
                    });
                }
            }

            var currentMonitor = deviceInfo.MonitorInfos.Select(d => d.SerialNo).ToList();

            var monitorDatabase = await _context.MonitorDetail
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var monitorToDelete = monitorDatabase
                .Where(d => !currentMonitor.Contains(d.SerialNo))
                .ToList();

            if (monitorToDelete.Any())
            {
                _context.MonitorDetail.RemoveRange(monitorToDelete);
            }

            foreach (var network in deviceInfo.NetworkDetails)
            {
                var existingNetwork = _context.NetworkDetail.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.InterfaceName == network.InterfaceName
                );

                if (existingNetwork != null)
                {
                    existingNetwork.IPAddress = network.IPAddress;
                    existingNetwork.MACAddress = network.MACAddress;
                }
                else
                {
                    _context.NetworkDetail.Add(new NetworkDetail
                    {
                        Hostname = existingDevice.Hostname,
                        InterfaceName = network.InterfaceName,
                        IPAddress = network.IPAddress,
                        MACAddress = network.MACAddress,
                        NetworkType = network.NetworkType
                    });
                }
            }

            var currentnetwork = deviceInfo.NetworkDetails.Select(d => d.MACAddress).ToList();

            var networkDatabase = await _context.NetworkDetail
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var networkToDelete = networkDatabase
                .Where(d => !currentnetwork.Contains(d.MACAddress))
                .ToList();

            if (networkToDelete.Any())
            {
                _context.NetworkDetail.RemoveRange(networkToDelete);
            }

            foreach (var antivirus in deviceInfo.antivirusInfos)
            {
                var existingAntivirus = _context.antivirusInfos.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.DisplayName == antivirus.DisplayName
                );

                if (existingAntivirus != null)
                {
                    existingAntivirus.ProductState = antivirus.ProductState;
                    existingAntivirus.LastUpdate = antivirus.LastUpdate;
                }
                else
                {
                    _context.antivirusInfos.Add(new antivirusInfos
                    {
                        Hostname = existingDevice.Hostname,
                        DisplayName = antivirus.DisplayName,
                        LastUpdate = antivirus.LastUpdate,
                        ProductState = antivirus.ProductState
                    });
                }
            }

            var currentAnivirus = deviceInfo.antivirusInfos.Select(d => d.DisplayName).ToList();

            var antivirusDatabase = await _context.antivirusInfos
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var antivirusToDelete = antivirusDatabase
                .Where(d => !currentAnivirus.Contains(d.DisplayName))
                .ToList();

            if (antivirusToDelete.Any())
            {
                _context.antivirusInfos.RemoveRange(antivirusToDelete);
            }

            foreach (var memory in deviceInfo.PhysicalMemoryInfo)
            {
                var existingMemory = _context.PhysicalMemoryInfo.FirstOrDefault(d =>
                d.Hostname == existingDevice.Hostname &&
                d.DeviceLocator == memory.DeviceLocator
                );

                if (existingMemory != null)
                {
                    existingMemory.Manufacturer = memory.Manufacturer;
                    existingMemory.SerialNo = memory.SerialNo;
                    existingMemory.Capacity = memory.Capacity;
                }
                else
                {
                    _context.PhysicalMemoryInfo.Add(new PhysicalMemoryInfo
                    {
                        Hostname = existingDevice.Hostname,
                        DeviceLocator = memory.DeviceLocator,
                        Capacity = memory.Capacity,
                        Manufacturer = memory.Manufacturer,
                        SerialNo = memory.SerialNo
                    });
                }
            }

            var currentmemory = deviceInfo.PhysicalMemoryInfo.Select(d => d.SerialNo).ToList();

            var memoryDatabase = await _context.PhysicalMemoryInfo
                .Where(d => d.Hostname == existingDevice.Hostname)
                .ToListAsync();

            // Delete disks that are not in the current deviceInfo
            var memoryToDelete = memoryDatabase
                .Where(d => !currentmemory.Contains(d.SerialNo))
                .ToList();

            if (memoryToDelete.Any())
            {
                _context.PhysicalMemoryInfo.RemoveRange(memoryToDelete);
            }


            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {

            }

            return Ok();
        }

        [HttpPost("UpdateDepartment")]
        public async Task<IActionResult> UpdateDepartment([FromBody] List<ComputerInfo> computers)
        {
            if (computers == null || computers.Count == 0)
            {
                return BadRequest("No keys provided.");
            }
            foreach (var computer in computers)
            {
                var existingComputer = await _context.Devices
                    .FirstOrDefaultAsync(d => d.Department == computer.Department && d.Hostname == computer.ComputerName);

                if (existingComputer == null)
                {
                    var device = await _context.Devices.Where(x => x.Hostname == computer.ComputerName).FirstOrDefaultAsync();
                    if (device != null)
                    {
                        device.Department = computer.Department;
                    }
                }
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Department updated successfully." });
        }

        [HttpPost("UpdateBitLocker")]

        public async Task<IActionResult> UpdateBitLocker([FromBody] List<BitLockerKey> keys)
        {
            if (keys == null || keys.Count == 0)
            {
                return BadRequest("No keys provided.");
            }

            foreach (var key in keys)
            {
                // Check if a record with the same Hostname and Identifier already exists
                var existingBitlocker = await _context.BitLockerKey
                    .FirstOrDefaultAsync(d => d.Identifier == key.Identifier && d.Hostname == key.Hostname);

                if (existingBitlocker == null)
                {
                    // Add a new record if it doesn't exist
                    _context.BitLockerKey.Add(new BitLockerKey
                    {
                        Hostname = key.Hostname,
                        Identifier = key.Identifier,
                        PasswordId = key.PasswordId,
                        RecoveryKey = key.RecoveryKey
                    });
                }
            }

            // Get a list of Identifiers from the incoming data
            var bitLockerIdentifiers = keys.Select(d => d.Identifier).ToList();

            // Retrieve all existing records in the database
            var bitLockerDatabase = await _context.BitLockerKey.ToListAsync();

            // Identify keys that need to be deleted (not present in the incoming request)
            var keysToDelete = bitLockerDatabase
                .Where(d => !bitLockerIdentifiers.Contains(d.Identifier))
                .ToList();

            if (keysToDelete.Any())
            {
                _context.BitLockerKey.RemoveRange(keysToDelete);
            }

            await _context.SaveChangesAsync();

            return Ok(new { message = "BitLocker keys updated successfully." });
        }

        private async Task updateSoftwareUninstallStatus(List<SoftwareDetail> sd)
        {
            foreach (SoftwareDetail sd2 in sd)
            {
                UninstallInfo ui = _context.uninstallInfos.Where(x => x.applicationId == sd2.SoftwareDetailsID).FirstOrDefault();
                if (ui != null)
                {
                    ui.Active = 4;
                }
            }
            await _context.SaveChangesAsync();
        }

        [HttpGet]
        public async Task<IActionResult> GetDevices()
        {
            var devices = await _context.Devices
            .Select(d => new
            {
                d.Hostname,
                d.Username,
                d.Status,
                d.LastUpdated,
                d.Department
            })
            .ToListAsync();

            // Optionally notify clients when data is fetched
            await _hubContext.Clients.All.SendAsync("DevicesFetched", devices);

            return Ok(devices);
        }
        [HttpGet("{hostname}")]
        public async Task<IActionResult> GetDeviceDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.SystemDetails)
                .Include(d => d.PhysicalMemoryInfo)
                .Join(_context.Systems, r => r.Hostname, u => u.Hostname, (r, u) => new { r, u })
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var systemDetails = device.r.SystemDetails.FirstOrDefault();

            // Calculate memory slots
            var memorySlots = device.r.PhysicalMemoryInfo;
            int totalSlots = memorySlots.Count;
            int availableSlots = memorySlots.Count(m => !string.IsNullOrEmpty(m.SerialNo));

            var deviceDto = new
            {
                device.r.Hostname,
                device.r.Username,
                device.r.Status,
                device.r.LastUpdated,
                systemDetail = systemDetails != null ? new
                {
                    systemDetails.BIOSSerial,
                    systemDetails.Domain,
                    systemDetails.Hostname,
                    Model = systemDetails.Make + " -- " + systemDetails.Model,
                    systemDetails.OSName,
                    systemDetails.OSVersion,
                    systemDetails.ProcessorFamily,
                    MemorySlots = $"{availableSlots}/{totalSlots}", // Add memory slots info
                    PhysicalMemory = systemDetails.PhysicalMemory + " GB",
                    SystemId = device.u.SystemID
                } : null
            };

            return Ok(deviceDto);
        }
        //Get Bitlocker Key
        [HttpGet("{hostname}/bitlocker")]
        public async Task<IActionResult> GetBitLockerKey(string hostname)
        {

            var bitLocker = await _context.BitLockerKey.Where(x => x.Hostname.Equals(hostname)).Select(d => new
            {
                d.PasswordId,
                d.Identifier,
                d.RecoveryKey
            }).ToListAsync();

            return Ok(bitLocker);
        }
        // Get storage details (disks)
        [HttpGet("{hostname}/disks")]
        public async Task<IActionResult> GetDiskDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.DiskDetails)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var diskDetails = device.DiskDetails.Select(d => new
            {
                d.DiskName,
                d.Capacity,
                d.FreeSpace,
                d.TypeOfDrive,
                d.encryptionKey,
                d.isEncrypted
            }).ToList();

            return Ok(diskDetails);
        }

        // Get network details
        [HttpGet("{hostname}/network")]
        public async Task<IActionResult> GetNetworkDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.NetworkDetails)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var networkDetails = device.NetworkDetails.Select(n => new
            {
                n.IPAddress,
                n.MACAddress,
                n.InterfaceName,
                n.NetworkType
            }).ToList();

            return Ok(networkDetails);
        }

        [HttpGet("{hostname}/monitor")]
        public async Task<IActionResult> GetMonitorDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.MonitorDetails)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var monitorDetails = device.MonitorDetails.Select(n => new
            {
                n.Manufacturer,
                n.SerialNo,
                n.YearOfManufacture,
                n.DisplayName
            }).ToList();

            return Ok(monitorDetails);
        }

        // Get security details
        [HttpGet("{hostname}/security")]
        public async Task<IActionResult> GetSecurityDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.antivirusInfos)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var securityDetails = device.antivirusInfos.Select(s => new
            {
                s.DisplayName,
                s.ProductState,
                s.LastUpdate
            }).ToList();

            return Ok(securityDetails);
        }

        // Get users details
        [HttpGet("{hostname}/users")]
        public async Task<IActionResult> GetUserDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.LocalUserDetails)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }

            var userDetails = device.LocalUserDetails.Select(u => new
            {
                u.UserName,
                u.Description,
                u.IsEnabled,
                u.IsLocked
            }).ToList();

            return Ok(userDetails);
        }

        // Get software details
        [HttpGet("{hostname}/software")]
        public async Task<IActionResult> GetSoftwareDetails(string hostname)
        {
            var device = await _context.Devices
                .Where(d => d.Hostname == hostname)
                .Include(d => d.SoftwareDetails)
                .FirstOrDefaultAsync();

            if (device == null)
            {
                return NotFound();
            }


            var softwareDetails = await (from s in _context.SoftwareDetails

                                             // Left join with UninstallInfo
                                         join u in _context.uninstallInfos
                                         on s.SoftwareDetailsID equals u.applicationId into uninstallGroup
                                         from u in uninstallGroup.DefaultIfEmpty() // Keeps all software even if no matching uninstall record

                                         where s.Hostname == hostname
                                         select new
                                         {
                                             s.SoftwareDetailsID,
                                             s.SoftwareName,
                                             s.Version,
                                             s.Publisher,
                                             UninstallString = (u != null && u.Active == 1) ? "Unknown" : s.UninstallString
                                         }).ToListAsync();

            if (!softwareDetails.Any())
            {
                return NotFound();
            }

            return Ok(softwareDetails);
        }

        [HttpGet("software")]
        public async Task<ActionResult<IEnumerable<SoftwareDetail>>> GetSoftwares()
        {
            var devices = await _context.Devices
         .Include(d => d.SoftwareDetails) // Include software details
         .Select(d => new
         {
             d.Hostname,
             d.Username,
             SoftwareDetails = d.SoftwareDetails.Select(s => new
             {
                 s.SoftwareName,
                 s.Version,
                 s.Publisher
             })
         })
         .ToListAsync();

            return Ok(devices);
        }

    }
}
