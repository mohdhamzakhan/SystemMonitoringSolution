using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System.Diagnostics;
using System.Diagnostics.Eventing.Reader;
using System.DirectoryServices;
using System.DirectoryServices.AccountManagement;
using System.Globalization;
using System.Management;
using System.Management.Automation;
using System.Net.Http.Json;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Runtime.ExceptionServices;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Security.Cryptography;
using System.Text;

namespace SystemMonitorWorker
{
    public class Worker : BackgroundService
    {
        private readonly ILogger<Worker> _logger;
        private readonly HttpClient _httpClient;
        private const string ApiBaseUrl = @"http://10.235.20.49:5295/api";
        string password = string.Empty;
        string workingDirectory = @"C:\MEAI\Installer";
        private readonly object _eventFileLock = new();
        private readonly string _eventStorePath =
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "SystemMonitor",
                "offline_events.json");

        public Worker(ILogger<Worker> logger, HttpClient httpClient)
        {
            _logger = logger;
            _httpClient = httpClient;
        }
        private void HideLocalFolder()
        {
            try
            {
                var folderPath = @"C:\SystemMonitor";
                if (Directory.Exists(folderPath))
                {
                    var dirInfo = new DirectoryInfo(folderPath);
                    dirInfo.Attributes |= FileAttributes.Hidden | FileAttributes.System;
                    _logger.LogInformation("Local folder hidden");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Could not hide local folder");
            }
        }


        public override async Task StartAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Service starting");

            SaveEvent("Startup"); // Startup detected
            await SyncEventsToApiAsync(); // Sync pending events

            // NEW: ensure the 15‑min task exists
            try
            {
                await RegisterTaskFor15MinCheck();
                HideLocalFolder();
                _logger.LogInformation("15‑minute CheckAndRun task registered/updated.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to register 15‑minute CheckAndRun task.");
            }

            SystemEvents.SessionSwitch += OnSessionSwitch;
            SystemEvents.SessionEnding += OnSessionEnding;

            NetworkChange.NetworkAvailabilityChanged += async (_, e) =>
            {
                if (e.IsAvailable)
                {
                    await SyncEventsToApiAsync();
                }
            };

            await base.StartAsync(cancellationToken);
        }


        private void OnSessionSwitch(object sender, SessionSwitchEventArgs e)
        {
            string eventType = e.Reason switch
            {
                SessionSwitchReason.SessionLogon => "Login",
                SessionSwitchReason.SessionLogoff => "Logout",
                SessionSwitchReason.SessionLock => "Lock",
                SessionSwitchReason.SessionUnlock => "Unlock",
                _ => null
            };

            if (eventType == null) return;

            SaveEvent(eventType);
        }
        private void OnSessionEnding(object sender, SessionEndingEventArgs e)
        {
            SaveEvent("Shutdown");
        }




        #region TaskRegisterForEvery15MinCheck
        private async Task RegisterTaskFor15MinCheck()
        {
            // Define the PowerShell script file path in C#
            string scriptPath = Path.Combine(workingDirectory, "CheckAndRun.vbs");
            //            string command = @"
            //On Error Resume Next
            //Set objWMIService = GetObject(""winmgmts:\\.\root\cimv2"")
            //Set colProcesses = objWMIService.ExecQuery(""Select * from Win32_Process Where Name='SystemMonitorWorker.exe'"")

            //If colProcesses.Count = 0 Then
            //    Set objShell = CreateObject(""WScript.Shell"")
            //    objShell.Run ""\\meaisdfs\PUBLIC_SANAND\04IT_Sanand\02_Open_to_all\SystemMonitorWorker\SystemMonitorWorker.exe"", 0, False
            //End If
            //If Err.Number <> 0 Then
            //    Err.Clear
            //End If

            //Set objWMIService = Nothing
            //Set colProcesses = Nothing
            //Set objShell = Nothing

            //";
            string networkPath = @"\\meaisdfs\PUBLIC_SANAND\04IT_Sanand\02_Open_to_all\SystemMonitorWorker\SystemMonitorWorker.exe";
            string networkFolder = @"\\meaisdfs\PUBLIC_SANAND\04IT_Sanand\02_Open_to_all\SystemMonitorWorker";
            string localFolder = @"C:\SystemMonitor";

            string command = $@"
On Error Resume Next

Dim objWMIService, colProcesses, objShell
Dim fso, localPathVBS, networkFolderVBS, localFolderVBS, logFile, exeName

localFolderVBS   = ""C:\SystemMonitor""
networkFolderVBS = ""\\meaisdfs\PUBLIC_SANAND\04IT_Sanand\02_Open_to_all\SystemMonitorWorker""
logFile          = ""C:\SystemMonitor\debug.log""
exeName          = ""SystemMonitorWorker.exe""

Set fso = CreateObject(""Scripting.FileSystemObject"")
Set objWMIService = GetObject(""winmgmts:\\.\root\cimv2"")
Set colProcesses = objWMIService.ExecQuery(""Select * from Win32_Process Where Name='SystemMonitorWorker.exe'"")

Dim ts: Set ts = fso.OpenTextFile(logFile, 8, True)
ts.WriteLine ""=== FULL FOLDER COPY: "" & Now()

If colProcesses.Count = 0 Then
    ts.WriteLine ""No process running""
    
    ' Ensure local folder exists
    If Not fso.FolderExists(localFolderVBS) Then
        fso.CreateFolder localFolderVBS
        ts.WriteLine ""Created local folder""
    End If
    
    ' DELETE old local folder contents first (for clean update)
    On Error Resume Next
    Dim localFiles: Set localFiles = fso.GetFolder(localFolderVBS).Files
    For Each file In localFiles
        fso.DeleteFile file.Path
    Next
    Dim localSubFolders: Set localSubFolders = fso.GetFolder(localFolderVBS).SubFolders
    For Each folder In localSubFolders
        fso.DeleteFolder folder.Path
    Next
    Err.Clear
    ts.WriteLine ""Cleared old local files""
    
    ' COPY ENTIRE NETWORK FOLDER
    If fso.FolderExists(networkFolderVBS) Then
        ts.WriteLine ""Network folder OK, copying entire folder...""
        
        ' Copy all files first
        Dim netFiles: Set netFiles = fso.GetFolder(networkFolderVBS).Files
        For Each netFile In netFiles
            fso.CopyFile netFile.Path, localFolderVBS & ""\"" & netFile.Name, True
        Next
        
        ' Copy all subfolders recursively
        Dim netFolders: Set netFolders = fso.GetFolder(networkFolderVBS).SubFolders
        For Each netFolder In netFolders
            CopyFolder netFolder.Path, localFolderVBS & ""\"" & netFolder.Name
        Next
        
        ts.WriteLine ""Folder copy COMPLETE - "" & netFiles.Count & "" files, "" & netFolders.Count & "" folders""
    Else
        ts.WriteLine ""Network folder MISSING""
    End If

    ' Run the EXE
    localPathVBS = localFolderVBS & ""\"" & exeName
    If fso.FileExists(localPathVBS) Then
        ts.WriteLine ""Running: "" & localPathVBS
        Set objShell = CreateObject(""WScript.Shell"")
        objShell.Run """" & localPathVBS & """", 0, False
    Else
        ts.WriteLine ""EXE not found after copy!""
    End If
Else
    ts.WriteLine ""Process already running""
End If

ts.WriteLine ""=== END ==="" & Now()
Set ts = Nothing

' Helper function for recursive folder copy
Sub CopyFolder(source, destination)
    On Error Resume Next
    Dim fso: Set fso = CreateObject(""Scripting.FileSystemObject"")
    If Not fso.FolderExists(destination) Then fso.CreateFolder destination
    
    Dim files: Set files = fso.GetFolder(source).Files
    For Each file In files
        fso.CopyFile file.Path, destination & ""\\\\"" & file.Name, True
    Next
    
    Dim folders: Set folders = fso.GetFolder(source).SubFolders
    For Each folder In folders
        CopyFolder folder.Path, destination & ""\\\\"" & folder.Name
    Next
End Sub
";




            File.WriteAllText(scriptPath, command);

            var parameterDate = DateTime.ParseExact("03/07/2025", "MM/dd/yyyy", CultureInfo.InvariantCulture);
            var todaysDate = DateTime.Today;
            string psScript = "";
            if (parameterDate > todaysDate)
            {
                psScript = $@"
# Define task name
$taskName = 'SMM_CheckAndRunSystemMonitor'

# Check if the task exists
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Start-Sleep -Seconds 5  # Small delay to ensure cleanup
}}


# Create the scheduled task action
$action = New-ScheduledTaskAction -Execute '""{scriptPath}'"" ""

# Create the trigger (every 15 minutes)
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) -Once -At (Get-Date).AddMinutes(1)


# Define task settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the scheduled task WITHOUT admin privileges
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User ""$env:UserName"" > $null 2>&1
";
                await Task.Run(() => ExecutePowerShellScript(psScript));
            }
            else
            {

                psScript = $@"
# Define task name
$taskName = 'SMM_CheckAndRunSystemMonitor'


# Create the scheduled task action
$action = New-ScheduledTaskAction -Execute '""{scriptPath}'"" ""

# Create the trigger (every 15 minutes)
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 15) -Once -At (Get-Date).AddMinutes(1)


# Define task settings
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Register the scheduled task WITHOUT admin privileges
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -User ""$env:UserName"" > $null 2>&1
";

                await Task.Run(() => ExecutePowerShellScript(psScript));
            }
        }




        #endregion

        #region Task That Will Run
        //protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        //{
        //    _logger.LogInformation("System Monitoring Service started.");

        //    var lastSystemInfoSent = DateTime.MinValue;  // Track the last time system info was sent
        //    var heartbeatInterval = TimeSpan.FromMinutes(5);
        //    var systemInfoInterval = TimeSpan.FromMinutes(30);// Send system info once a day
        //    //await SendHeartbeatToApi();

        //    //await Task.Delay(100000);
        //    while (!stoppingToken.IsCancellationRequested)
        //    {
        //        try
        //        {
        //            var currentTime = DateTime.Now;

        //            // Send system information once a day
        //            if (currentTime - lastSystemInfoSent >= systemInfoInterval)
        //            {
        //                var hostname = Environment.MachineName;
        //                try
        //                {
        //                    #region uninstalltion
        //                    var uninstalltions = await FetchUninstalltionFromApi(hostname);
        //                    string username = "";
        //                    string password = "";
        //                    string fileName = $@"{workingDirectory}\uninstall.bat";

        //                    if (File.Exists(fileName))
        //                        File.Delete(fileName);

        //                    if (uninstalltions.Any())
        //                    {
        //                        try
        //                        {
        //                            foreach (var uninstallation in uninstalltions)
        //                            {
        //                                _logger.LogInformation($"Uninstallation is present {uninstallation.softwareName}");
        //                                string command = "";
        //                                if (uninstallation.UninstallString.Contains("MsiExec.exe"))
        //                                {
        //                                    command += $"START /WAIT {uninstallation.UninstallString.Replace("/X{", "/X {")} /quiet /norestart {Environment.NewLine}";
        //                                }
        //                                else
        //                                {
        //                                    command += $"{uninstallation.UninstallString} {Environment.NewLine}";
        //                                }

        //                                File.AppendAllText(fileName, command);
        //                                if (string.IsNullOrEmpty(username))
        //                                {
        //                                    username = uninstallation.Username;
        //                                    password = uninstallation.Password;
        //                                }
        //                            }
        //                        }
        //                        catch (Exception ex)
        //                        {
        //                            _logger.LogInformation(ex.Message);
        //                        }
        //                        finally
        //                        {

        //                            if (File.Exists(fileName))
        //                            {

        //                                _logger.LogInformation("File created successfully.");
        //                                await RunUninstallationScript(fileName, username, password);
        //                            }
        //                            else
        //                            {
        //                                throw new Exception("Unable to create a file");
        //                            }

        //                        }

        //                    }
        //                    #endregion
        //                }
        //                catch (Exception ex)
        //                {
        //                    _logger.LogInformation(ex.Message);
        //                }
        //                try
        //                {

        //                    #region Installation
        //                    var updates = await FetchUpdatesFromApi(hostname);
        //                    if (updates != null)
        //                    {
        //                        if (updates.Any())
        //                        {
        //                            foreach (var update in updates)
        //                            {
        //                                try
        //                                {
        //                                    _logger.LogInformation($"Processing update: {update.FilePath}");

        //                                    // Copy the file to the target system
        //                                    if (!Directory.Exists(workingDirectory))
        //                                    {
        //                                        Directory.CreateDirectory(workingDirectory);
        //                                    }
        //                                    else
        //                                    {
        //                                        try
        //                                        {
        //                                            Directory.Delete(workingDirectory);
        //                                            Directory.CreateDirectory(workingDirectory);
        //                                        }
        //                                        catch { }
        //                                    }
        //                                    var localPath = workingDirectory + @"\" + Path.GetFileName(update.FilePath);
        //                                    await CopyFileFromUNC(update.FilePath, localPath);
        //                                    _logger.LogInformation("File copied successfully.");
        //                                    // Run the installation
        //                                    if (Path.GetExtension(localPath) != ".zip")
        //                                    {
        //                                        await RunInstallationScript(localPath, update.Parameters, update.Username, update.Password);
        //                                    }
        //                                    else
        //                                    {
        //                                        await RunInstallationScript(localPath, update.FileName, update.Parameters, update.Username, update.Password);
        //                                    }

        //                                    // Report success to the API
        //                                    await ReportUpdateStatusToApi(update.UpdateID, "Completed", update.SystemID, "Successfully Installed");
        //                                    _logger.LogInformation("Installation completed successfully.");
        //                                }
        //                                catch (Exception ex)
        //                                {
        //                                    _logger.LogError(ex, $"Error processing update: {ex.Message}");
        //                                    await ReportUpdateStatusToApi(update.UpdateID, "Failed", update.SystemID, ex.Message);
        //                                }
        //                                break;
        //                            }
        //                        }
        //                    }

        //                    // Wait for the next interval
        //                    //await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);

        //                    #endregion


        //                }
        //                catch (Exception ex)
        //                {
        //                    _logger.LogInformation(ex.Message);
        //                }
        //                _logger.LogInformation("Sending system information to API...");
        //                try
        //                {
        //                    var systemInfo = CollectSystemInformation();
        //                    await SendSystemInformationToApi(systemInfo);
        //                    lastSystemInfoSent = currentTime;  // Update the last sent time
        //                    _logger.LogInformation("System information sent successfully.");
        //                }
        //                catch (Exception ex)
        //                {
        //                    _logger.LogError(ex, "Error sending system information to API.");
        //                }
        //            }

        //            // Send heartbeat every 30 seconds
        //            _logger.LogInformation("Sending heartbeat to API...");
        //            try
        //            {
        //                await SendHeartbeatToApi();
        //                _logger.LogInformation("Heartbeat sent successfully.");
        //            }
        //            catch (Exception ex)
        //            {
        //                _logger.LogError(ex, "Error sending heartbeat to API.");
        //            }

        //            // Wait for the next heartbeat interval
        //            await Task.Delay(heartbeatInterval, stoppingToken);
        //        }
        //        catch (TaskCanceledException)
        //        {
        //            // Graceful exit when the stoppingToken is canceled
        //            _logger.LogInformation("Service stopping due to cancellation request.");
        //        }
        //        catch (Exception ex)
        //        {
        //            _logger.LogError(ex, "Error in system monitoring loop.");
        //            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);  // Retry after a delay
        //        }
        //    }

        //    _logger.LogInformation("System Monitoring Service stopped.");
        //}

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("System Monitoring Service started.");

            var lastSystemInfoSent = DateTime.MinValue;
            var heartbeatInterval = TimeSpan.FromMinutes(5);
            var systemInfoInterval = TimeSpan.FromMinutes(30);

            while (!stoppingToken.IsCancellationRequested)
            {

                try
                {
                    var currentTime = DateTime.Now;
                    await SyncEventsToApiAsync();
                    if (currentTime - lastSystemInfoSent >= systemInfoInterval)
                    {
                        var hostname = Environment.MachineName;

                        #region Uninstallation

                        try
                        {
                            var uninstallations = await FetchUninstalltionFromApi(hostname);
                            string username = "", password = "";
                            string uninstallFile = Path.Combine(workingDirectory, "uninstall.bat");

                            if (File.Exists(uninstallFile))
                                File.Delete(uninstallFile);

                            if (uninstallations.Any())
                            {
                                foreach (var item in uninstallations)
                                {
                                    _logger.LogInformation($"Uninstallation is present: {item.softwareName}");
                                    string command = item.UninstallString.Contains("MsiExec.exe")
                                        ? $"START /WAIT {item.UninstallString.Replace("/X{", "/X {")} /quiet /norestart{Environment.NewLine}"
                                        : $"{item.UninstallString}{Environment.NewLine}";

                                    File.AppendAllText(uninstallFile, command);

                                    if (string.IsNullOrEmpty(username))
                                    {
                                        username = item.Username;
                                        password = item.Password;
                                    }
                                }

                                if (File.Exists(uninstallFile))
                                {
                                    _logger.LogInformation("Uninstallation script file created.");
                                    await RunUninstallationScript(uninstallFile, username, password);
                                }
                                else
                                {
                                    throw new Exception("Uninstallation script file could not be created.");
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error during uninstallation process.");
                        }

                        #endregion

                        #region Installation

                        try
                        {
                            var updates = await FetchUpdatesFromApi(hostname);
                            if (updates != null && updates.Any())
                            {
                                foreach (var update in updates)
                                {
                                    try
                                    {
                                        _logger.LogInformation($"Processing update: {update.FilePath}");

                                        if (Directory.Exists(workingDirectory))
                                        {
                                            try
                                            {
                                                Directory.Delete(workingDirectory, true);
                                            }
                                            catch { /* Ignore delete errors */ }
                                        }

                                        Directory.CreateDirectory(workingDirectory);

                                        var localPath = Path.Combine(workingDirectory, Path.GetFileName(update.FilePath));
                                        await CopyFileFromUNC(update.FilePath, localPath);
                                        _logger.LogInformation("File copied successfully.");

                                        if (Path.GetExtension(localPath) == ".zip")
                                        {
                                            await RunInstallationScript(localPath, update.FileName, update.Parameters, update.Username, update.Password, update.isLocal);
                                        }
                                        else
                                        {
                                            await RunInstallationScript(localPath, update.Parameters, update.Username, update.Password, update.isLocal);
                                        }

                                        await ReportUpdateStatusToApi(update.UpdateID, "Completed", update.SystemID, "Successfully Installed");
                                        _logger.LogInformation("Installation completed successfully.");
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogError(ex, $"Error processing update: {ex.Message}");
                                        await ReportUpdateStatusToApi(update.UpdateID, "Failed", update.SystemID, ex.Message);
                                    }

                                    break; // Process only the first update
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error fetching or processing updates.");
                        }

                        #endregion

                        #region System Info Reporting

                        try
                        {
                            _logger.LogInformation("Sending system information to API...");
                            var systemInfo = CollectSystemInformation();
                            await SendSystemInformationToApi(systemInfo);
                            lastSystemInfoSent = currentTime;
                            _logger.LogInformation("System information sent successfully.");
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error sending system information to API.");
                        }

                        #endregion
                    }

                    #region Heartbeat

                    try
                    {
                        _logger.LogInformation("Sending heartbeat to API...");
                        await SendHeartbeatToApi();
                        _logger.LogInformation("Heartbeat sent successfully.");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error sending heartbeat to API.");
                    }

                    #endregion

                    await Task.Delay(heartbeatInterval, stoppingToken);
                }
                catch (TaskCanceledException)
                {
                    _logger.LogInformation("Service stopping due to cancellation request.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in system monitoring loop.");
                    await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
                }
            }

            _logger.LogInformation("System Monitoring Service stopped.");
        }


        #endregion

        #region Installation

        public async Task<string> FetchPasswordFromApi(string hostname)
        {
            var client = new HttpClient();
            try
            {
                // Make the GET request to fetch the password
                var response = await client.GetAsync($"{ApiBaseUrl}/Installation/password?hostname={hostname}");

                // Ensure the response is successful
                response.EnsureSuccessStatusCode();

                // Read the response as a string (this is the decrypted password)
                var password = await response.Content.ReadAsStringAsync();
                return password;
            }
            catch (Exception ex)
            {
                // Handle any errors (e.g., API not reachable, invalid response, etc.)
                Console.WriteLine($"Error fetching password: {ex.Message}");
                throw;
            }
        }
        public class UninstallInfo
        {
            [JsonProperty("uninstallId")]
            public int uninstallId { get; set; }
            [JsonProperty("applicationId")]
            public int applicationId { get; set; }
            [JsonProperty("uninstallString")]
            public string UninstallString { get; set; }
            [JsonProperty("username")]
            public string Username { get; set; }
            [JsonProperty("encryptedPassword")]
            public string Password { get; set; }
            [JsonProperty("softwareName")]
            public string softwareName { get; set; }
        }
        public class UpdateInfo
        {
            [JsonProperty("SystemID")]
            public int SystemID { get; set; }
            [JsonProperty("UpdateID")]
            public int UpdateID { get; set; }

            [JsonProperty("FilePath")]
            public string FilePath { get; set; }

            [JsonProperty("Parameters")]
            public string Parameters { get; set; }
            [JsonProperty("Username")]
            public string Username { get; set; }
            [JsonProperty("encryptedPassword")]
            public string Password { get; set; }
            [JsonProperty("FileName")]
            public string FileName { get; set; }
            [JsonProperty("isLocal")]
            public bool isLocal { get; set; }
        }

        public class UpdateStatusRequest
        {
            public int SystemID { get; set; } // The ID of the update being reported
            public int UpdateID { get; set; } // The ID of the update being reported
            public string Hostname { get; set; } // The hostname of the system being updated
            public string Status { get; set; } // The status of the update (e.g., Success, Failure)
            public string Message { get; set; } // Optional message for additional details
            public string StatusMessage { get; set; }
        }

        private async Task<List<UpdateInfo>> FetchUpdatesFromApi(string hostname)
        {
            var client = new HttpClient();
            var response = await client.GetAsync($"{ApiBaseUrl}/Installation/updates/{hostname}");
            response.EnsureSuccessStatusCode();

            // Read response as a string
            var jsonResponse = await response.Content.ReadAsStringAsync();

            // Deserialize JSON string into a list of UpdateInfo
            if (jsonResponse != "No updates required for the specified hostname." && jsonResponse != null)
            {
                var updates = JsonConvert.DeserializeObject<List<UpdateInfo>>(jsonResponse);

                return updates;
            }
            else if (jsonResponse != "No updates required for the specified hostname.")
            {
                return null;
            }
            return null;

        }



        private async Task ReportUpdateStatusToApi(int updateID, string status, int systemID, string message)
        {
            var client = new HttpClient();
            var request = new UpdateStatusRequest
            {
                SystemID = systemID,
                UpdateID = updateID,
                Status = status,
                // Make sure this field is valid
                StatusMessage = message
            };

            var response = await client.PostAsJsonAsync($"{ApiBaseUrl}/Installation/update-status", request);
            response.EnsureSuccessStatusCode();
        }

        private async Task CopyFileFromUNC(string sourcePath, string destinationPath)
        {
            if (!Directory.Exists(Path.GetDirectoryName(destinationPath)))
            {
                Directory.CreateDirectory(Path.GetDirectoryName(destinationPath));
            }

            await Task.Run(() => File.Copy(sourcePath, destinationPath, overwrite: true));
        }

        #region Run Task

        #region OldCode
        //        private async Task RunInstallationScript(string installerPath, string parameters, string username, string encryptedPassword)
        //        {
        //            if (string.IsNullOrWhiteSpace(installerPath))
        //                throw new ArgumentException("Installer path cannot be null or empty", nameof(installerPath));
        //            if (string.IsNullOrWhiteSpace(username))
        //                throw new ArgumentException("Username cannot be null or empty", nameof(username));
        //            if (string.IsNullOrWhiteSpace(encryptedPassword))
        //                throw new ArgumentException("Encrypted password cannot be null or empty", nameof(encryptedPassword));

        //            // Decrypt the password
        //            var password = Decrypt(encryptedPassword, true);

        //            // Escape special characters
        //            installerPath = installerPath.Replace("'", "''");
        //            parameters = parameters ?? string.Empty;
        //            username = username.Replace("'", "''");
        //            password = password.Replace("'", "''");

        //            // Build PowerShell script
        //            var psScript = $@"
        //$env:PSModulePath += ';C:\Windows\System32\WindowsPowerShell\v1.0\Modules'
        //Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
        //Import-Module ScheduledTasks

        //# Task Name
        //$taskName = 'SMM_TemporaryInstallationTask'

        //# Check if the task exists
        //if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{
        //    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        //    Start-Sleep -Seconds 5  # Small delay to ensure cleanup
        //}}

        //# Convert password to SecureString
        //$securePassword = ConvertTo-SecureString '{password}' -AsPlainText -Force

        //# Create a credential object
        //$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)

        //# Define the scheduled task action
        //$action = New-ScheduledTaskAction -Execute '{installerPath}' -Argument '{parameters}'

        //# Define the trigger (run immediately)
        //$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)

        //# Define the principal with elevation
        //$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest

        //# Register the scheduled task
        //Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -User '{username}' -Password '{password}'

        //# Start the scheduled task
        //Start-ScheduledTask -TaskName $taskName

        //# Wait for 15 minutes (900 seconds)
        //#Start-Sleep -Seconds 900
        //#}}

        //# Clean up the scheduled task
        //#Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        //";



        //            // Run PowerShell script asynchronously
        //            Console.WriteLine("Async Task Started");
        //            await Task.Run(() => ExecutePowerShellScript(psScript));
        //            Console.WriteLine("Async Task Stopped");
        //        }


        //        private async Task RunInstallationScript(string zipFilePath, string installerExeName, string parameters, string username, string encryptedPassword)
        //        {
        //            var password = Decrypt(encryptedPassword, true);

        //            // Define the extraction path
        //            string extractionPath = Path.Combine(workingDirectory + @"\", Path.GetFileNameWithoutExtension(zipFilePath));

        //            // PowerShell script to unzip the file and run the installer
        //            //            var psScript = $@"

        //            //# Ensure the module is loaded (Optional: You can skip if not needed)
        //            //$env:PSModulePath += ';C:\Windows\System32\WindowsPowerShell\v1.0\Modules';
        //            //Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force;
        //            //Import-Module ScheduledTasks;
        //            //    Import-Module Microsoft.PowerShell.Archive;


        //            //    # Unzip the file
        //            //    Expand-Archive -Path '{zipFilePath}' -DestinationPath '{extractionPath}' -Force

        //            //    # Get the path to the installer executable
        //            //    $installerPath = '{Path.Combine(extractionPath, installerExeName)}'

        //            //   # Convert password to SecureString
        //            //$securePassword = ConvertTo-SecureString '{password}' -AsPlainText -Force

        //            //# Create a credential object
        //            //$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)

        //            //# Define the scheduled task action
        //            //$action = New-ScheduledTaskAction -Execute $installerPath -Argument '{parameters}'

        //            //# Define the trigger (run immediately)
        //            //$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)

        //            //# Define the principal with elevation
        //            //$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest

        //            //# Register the scheduled task
        //            //Register-ScheduledTask -TaskName 'TemporaryInstallationTask' -Action $action -Trigger $trigger -User '{username}' -Password '{password}'

        //            //# Start the scheduled task
        //            //Start-ScheduledTask -TaskName 'TemporaryInstallationTask'

        //            //# Clean up the scheduled task after it runs
        //            //Start-Sleep -Seconds 20
        //            //Unregister-ScheduledTask -TaskName 'TemporaryInstallationTask' -Confirm:$false";

        //            var psScript = $@"
        //# Ensure the module is loaded (Optional: You can skip if not needed)
        //$env:PSModulePath += ';C:\Windows\System32\WindowsPowerShell\v1.0\Modules';
        //Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force;
        //Import-Module ScheduledTasks;
        //Import-Module Microsoft.PowerShell.Archive;

        //# Task Name
        //$taskName = 'SMM_TemporaryInstallationTask'

        //# Unregister existing scheduled task if present
        //if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{
        //    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        //    Start-Sleep -Seconds 5  # Small delay to ensure cleanup
        //}}

        //# Unzip the file
        //Expand-Archive -Path '{zipFilePath}' -DestinationPath '{extractionPath}' -Force

        //# Get the path to the installer executable
        //$installerPath = '{Path.Combine(extractionPath, installerExeName)}'

        //# Convert password to SecureString
        //$securePassword = ConvertTo-SecureString '{password}' -AsPlainText -Force

        //# Create a credential object
        //$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)

        //# Define the scheduled task action
        //$action = New-ScheduledTaskAction -Execute $installerPath -Argument '{parameters}'

        //# Define the trigger (run immediately)
        //$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)

        //# Define the principal with elevation
        //$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest

        //# Register the scheduled task
        //Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -User '{username}' -Password '{password}'

        //# Start the scheduled task
        //Start-ScheduledTask -TaskName $taskName

        //# Wait for 15 minutes (900 seconds)
        //#Start-Sleep -Seconds 900

        //# Delete the installer and extracted files
        //#if (Test-Path $installerPath) {{
        //    #Remove-Item -Path $installerPath -Force
        //#}}

        //#if (Test-Path '{extractionPath}') {{
        //   # Remove-Item -Path '{extractionPath}' -Recurse -Force
        //#}}

        //# Delete the ZIP file
        //#if (Test-Path '{zipFilePath}') {{
        //    #Remove-Item -Path '{zipFilePath}' -Force
        //#}}

        //# Clean up the scheduled task
        //#Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
        //";


        //            await Task.Run(() => ExecutePowerShellScript(psScript));
        //        }

        #endregion

        private async Task RunInstallationScript(string installerPath, string parameters, string username, string encryptedPassword, bool isLocal)
        {
            if (string.IsNullOrWhiteSpace(installerPath))
            {
                throw new ArgumentException("Installer path cannot be null or empty", "installerPath");
            }
            if (string.IsNullOrWhiteSpace(username))
            {
                throw new ArgumentException("Username cannot be null or empty", "username");
            }
            if (string.IsNullOrWhiteSpace(encryptedPassword))
            {
                throw new ArgumentException("Encrypted password cannot be null or empty", "encryptedPassword");
            }
            string text = Decrypt(encryptedPassword, useHashing: true);
            installerPath = installerPath.Replace("'", "''");
            parameters = parameters ?? string.Empty;
            username = username.Replace("'", "''");
            text = text.Replace("'", "''");
            if (!isLocal)
            {
                string psScript = $"\r\n$env:PSModulePath += ';C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'\r\nSet-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force\r\nImport-Module ScheduledTasks\r\n\r\n# Task Name\r\n$taskName = 'SMM_TemporaryInstallationTask'\r\n\r\n# Check if the task exists\r\nif (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{\r\n    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n    Start-Sleep -Seconds 5  # Small delay to ensure cleanup\r\n}}\r\n\r\n# Convert password to SecureString\r\n$securePassword = ConvertTo-SecureString '{text}' -AsPlainText -Force\r\n\r\n# Create a credential object\r\n$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)\r\n\r\n# Define the scheduled task action\r\n$action = New-ScheduledTaskAction -Execute '{installerPath}' -Argument '{parameters}'\r\n\r\n# Define the trigger (run immediately)\r\n$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)\r\n\r\n# Define the principal with elevation\r\n$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest\r\n\r\n# Register the scheduled task\r\nRegister-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -User '{username}' -Password '{text}'\r\n\r\n# Start the scheduled task\r\nStart-ScheduledTask -TaskName $taskName\r\n\r\n# Wait for 15 minutes (900 seconds)\r\n#Start-Sleep -Seconds 900\r\n#}}\r\n\r\n# Clean up the scheduled task\r\n#Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n";
                Console.WriteLine("Async Task Started");
                await Task.Run(() => ExecutePowerShellScript(psScript));
                Console.WriteLine("Async Task Stopped");
            }
            else
            {
                string psScript2 = $"\r\n$env:PSModulePath += ';C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'\r\nSet-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force\r\nImport-Module ScheduledTasks\r\n\r\n# Task Name\r\n$taskName = 'SMM_TemporaryInstallationTask'\r\n\r\n# Delete existing task if present\r\nif (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{\r\n    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n    Start-Sleep -Seconds 5\r\n}}\r\n\r\n# Define action (what to run)\r\n$action = New-ScheduledTaskAction -Execute '{installerPath}' -Argument '{parameters}'\r\n\r\n# Define trigger (when to run)\r\n$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(10))\r\n\r\n# Define principal (current user, no elevation)\r\n$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited\r\n\r\n# Define task settings\r\n$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries\r\n\r\n# Create the scheduled task\r\nRegister-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings\r\n\r\n# Start the scheduled task\r\nStart-ScheduledTask -TaskName $taskName\r\n";
                Console.WriteLine("Async Task Started");
                await Task.Run(() => ExecutePowerShellScript(psScript2));
                Console.WriteLine("Async Task Stopped");
            }
        }

        private async Task RunInstallationScript(string zipFilePath, string installerExeName, string parameters, string username, string encryptedPassword, bool isLocal)
        {
            string value = Decrypt(encryptedPassword, useHashing: true);
            string text = Path.Combine(workingDirectory + "\\", Path.GetFileNameWithoutExtension(zipFilePath));
            if (!isLocal)
            {
                string psScript = $"\r\n# Ensure the module is loaded (Optional: You can skip if not needed)\r\n$env:PSModulePath += ';C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules';\r\nSet-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force;\r\nImport-Module ScheduledTasks;\r\nImport-Module Microsoft.PowerShell.Archive;\r\n\r\n# Task Name\r\n$taskName = 'SMM_TemporaryInstallationTask'\r\n\r\n# Unregister existing scheduled task if present\r\nif (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{\r\n    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n    Start-Sleep -Seconds 5  # Small delay to ensure cleanup\r\n}}\r\n\r\n# Unzip the file\r\nExpand-Archive -Path '{zipFilePath}' -DestinationPath '{text}' -Force\r\n\r\n# Get the path to the installer executable\r\n$installerPath = '{Path.Combine(text, installerExeName)}'\r\n\r\n# Convert password to SecureString\r\n$securePassword = ConvertTo-SecureString '{value}' -AsPlainText -Force\r\n\r\n# Create a credential object\r\n$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)\r\n\r\n# Define the scheduled task action\r\n$action = New-ScheduledTaskAction -Execute $installerPath -Argument '{parameters}'\r\n\r\n# Define the trigger (run immediately)\r\n$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)\r\n\r\n# Define the principal with elevation\r\n$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest\r\n\r\n# Register the scheduled task\r\nRegister-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -User '{username}' -Password '{value}'\r\n\r\n# Start the scheduled task\r\nStart-ScheduledTask -TaskName $taskName\r\n\r\n# Wait for 15 minutes (900 seconds)\r\n#Start-Sleep -Seconds 900\r\n\r\n# Delete the installer and extracted files\r\n#if (Test-Path $installerPath) {{\r\n    #Remove-Item -Path $installerPath -Force\r\n#}}\r\n\r\n#if (Test-Path '{text}') {{\r\n   # Remove-Item -Path '{text}' -Recurse -Force\r\n#}}\r\n\r\n# Delete the ZIP file\r\n#if (Test-Path '{zipFilePath}') {{\r\n    #Remove-Item -Path '{zipFilePath}' -Force\r\n#}}\r\n\r\n# Clean up the scheduled task\r\n#Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n";
                await Task.Run(() => ExecutePowerShellScript(psScript));
            }
            else
            {
                string psScript2 = $"\r\n$env:PSModulePath += ';C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'\r\nSet-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force\r\nImport-Module ScheduledTasks\r\nImport-Module Microsoft.PowerShell.Archive\r\n\r\n$taskName = 'SMM_TemporaryInstallationTask'\r\n\r\n# Remove existing task\r\nif (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{\r\n    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n    Start-Sleep -Seconds 5\r\n}}\r\n\r\n# Extract installer\r\nExpand-Archive -Path '{zipFilePath}' -DestinationPath '{text}' -Force\r\n$installerPath = '{Path.Combine(text, installerExeName)}'\r\n\r\n# Schedule task\r\n$action = New-ScheduledTaskAction -Execute $installerPath -Argument '{parameters}'\r\n$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddSeconds(10))\r\n$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited\r\n$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries\r\n\r\nRegister-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings\r\nStart-ScheduledTask -TaskName $taskName\r\n\r\nStart-Sleep -Seconds 45\r\n\r\n# === Auto-detect Uninstall Registry Key and Hide It ===\r\n$displayNameToFind = '{installerExeName.Split('.')[0]}'  # Example: 'My Cool App'\r\n$uninstallBasePath = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'\r\n\r\n$uninstallKey = Get-ChildItem -Path $uninstallBasePath | Where-Object {{\r\n    (Get-ItemProperty $_.PSPath).DisplayName -eq $displayNameToFind\r\n}}\r\n\r\nif ($uninstallKey) {{\r\n    Set-ItemProperty -Path $uninstallKey.PSPath -Name 'SystemComponent' -Value 1 -Force\r\n}}\r\n\r\n# Optional cleanup\r\n# Start-Sleep -Seconds 900\r\n# if (Test-Path $installerPath) {{ Remove-Item -Path $installerPath -Force }}\r\n# if (Test-Path '{text}') {{ Remove-Item -Path '{text}' -Recurse -Force }}\r\n# if (Test-Path '{zipFilePath}') {{ Remove-Item -Path '{zipFilePath}' -Force }}\r\n# Unregister-ScheduledTask -TaskName $taskName -Confirm:$false\r\n";
                Console.WriteLine("Async Task Started");
                await Task.Run(() => ExecutePowerShellScript(psScript2));
                Console.WriteLine("Async Task Stopped");
            }
        }


        public async Task<string> ExecutePowerShellScript(string scriptText)
        {
            string logFile = "c:\\meai\\Installer\\powershell_debug_log.txt";
            try
            {
                File.WriteAllText(logFile, "Debug Start\n");

                var startInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe", // Change to "pwsh.exe" if using PowerShell Core
                    Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{scriptText}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using (var process = new Process { StartInfo = startInfo })
                {
                    process.Start();

                    string output = await process.StandardOutput.ReadToEndAsync();
                    string error = await process.StandardError.ReadToEndAsync();

                    process.WaitForExit();

                    File.AppendAllText(logFile, $"Output: {output}\nError: {error}\n");

                    if (!string.IsNullOrWhiteSpace(error))
                    {
                        throw new Exception($"PowerShell Error: {error}");
                    }

                    return output;
                }
            }
            catch (Exception ex)
            {
                File.AppendAllText(logFile, $"Exception: {ex.Message}\n{ex.StackTrace}\n");
                throw;
            }
        }





        #endregion

        #region Decrypt Password

        /// <summary>
        /// DeCrypt a string using dual encryption method. Return a DeCrypted clear string
        /// </summary>
        /// <param name="cipherString">encrypted string</param>
        /// <param name="useHashing">Did you use hashing to encrypt this data? pass true is yes</param>
        /// <returns></returns>
        private string Decrypt(string cipherString, bool useHashing)
        {
            cipherString = FixSPChart(cipherString);

            byte[] keyArray;
            byte[] toEncryptArray = Convert.FromBase64String(cipherString);

            //Get your key from config file to open the lock!
            //string key = (string)settingsReader.GetValue("SecurityKey", typeof(String));

            string key = "MEAI.123";

            if (useHashing)
            {
                MD5CryptoServiceProvider hashmd5 = new MD5CryptoServiceProvider();
                keyArray = hashmd5.ComputeHash(UTF8Encoding.UTF8.GetBytes(key));
                hashmd5.Clear();
            }
            else
                keyArray = UTF8Encoding.UTF8.GetBytes(key);

            TripleDESCryptoServiceProvider tdes = new TripleDESCryptoServiceProvider();
            tdes.Key = keyArray;
            tdes.Mode = CipherMode.ECB;
            tdes.Padding = PaddingMode.PKCS7;

            ICryptoTransform cTransform = tdes.CreateDecryptor();
            byte[] resultArray = cTransform.TransformFinalBlock(toEncryptArray, 0, toEncryptArray.Length);

            tdes.Clear();
            return UTF8Encoding.UTF8.GetString(resultArray);
        }

        #endregion Decrypt Password

        #region ChangeSPChart

        public static string ChangeSPChart(string sTheInput)
        {
            StringBuilder sRetMe = new StringBuilder(sTheInput);

            sRetMe.Replace('+', '-');
            sRetMe.Replace('/', '*');
            sRetMe.Replace('=', '!');
            sRetMe.Replace("'", "''");

            return sRetMe.ToString();
        }

        #endregion ChangeSPChart

        #region FixSPChart

        public static string FixSPChart(string sTheInput)
        {
            StringBuilder sRetMe = new StringBuilder(sTheInput);

            sRetMe.Replace('-', '+');
            sRetMe.Replace('*', '/');
            sRetMe.Replace('!', '=');
            sRetMe.Replace("''", "'");

            return sRetMe.ToString();
        }

        #endregion FixSPChart

        #endregion

        #region Uninstallation
        private async Task<List<UninstallInfo>> FetchUninstalltionFromApi(string hostname)
        {
            var client = new HttpClient();
            var response = await client.GetAsync($"{ApiBaseUrl}/Installation/uninstalltion/{hostname}");
            response.EnsureSuccessStatusCode();

            // Read response as a string
            var jsonResponse = await response.Content.ReadAsStringAsync();

            // Deserialize JSON string into a list of UninstallInfo
            var updates = JsonConvert.DeserializeObject<List<UninstallInfo>>(jsonResponse);

            return updates;
        }

        private async Task RunUninstallationScript(string filePath, string username, string encryptedPassword)
        {
            if (string.IsNullOrWhiteSpace(filePath))
                throw new ArgumentException("filePath cannot be null or empty", nameof(filePath));
            if (string.IsNullOrWhiteSpace(username))
                throw new ArgumentException("Username cannot be null or empty", nameof(username));
            if (string.IsNullOrWhiteSpace(encryptedPassword))
                throw new ArgumentException("Encrypted password cannot be null or empty", nameof(encryptedPassword));

            // Decrypt the password
            var password = Decrypt(encryptedPassword, true);

            // Escape special characters
            filePath = filePath.Replace("'", "''");
            username = username.Replace("'", "''");
            password = password.Replace("'", "''");

            // Build PowerShell script
            var psScript = $@"
$env:PSModulePath += ';C:\Windows\System32\WindowsPowerShell\v1.0\Modules'
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
Import-Module ScheduledTasks

# Task Name
$taskName = 'SMM_TemporaryUninstallationTask'

# Check if the task exists
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {{
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Start-Sleep -Seconds 5  # Small delay to ensure cleanup
}}

# Convert password to SecureString
$securePassword = ConvertTo-SecureString '{password}' -AsPlainText -Force

# Create a credential object
$credential = New-Object System.Management.Automation.PSCredential('{username}', $securePassword)

# Define the scheduled task action
$action = New-ScheduledTaskAction -Execute '{filePath}'

# Define the trigger (run immediately)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(10)

# Define the principal with elevation
$principal = New-ScheduledTaskPrincipal -UserId '{username}' -LogonType Password -RunLevel Highest

# Register the scheduled task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -User '{username}' -Password '{password}'

# Start the scheduled task
Start-ScheduledTask -TaskName $taskName

# Wait for 15 minutes (900 seconds)
#Start-Sleep -Seconds 900
#}}

# Clean up the scheduled task
#Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
";



            // Run PowerShell script asynchronously
            Console.WriteLine("Async Task Started");
            await Task.Run(() => ExecutePowerShellScript(psScript));
            Console.WriteLine("Async Task Stopped");
        }
        #endregion

        #region Collect and Send Details
        [SupportedOSPlatform("windows")]

        private DeviceInfo CollectSystemInformation()
        {
            // Initialize deviceInfo first
            string os = "";
            if (GetOSDetails("ProductName").Contains("Windows 10") && Convert.ToInt32(GetOSDetails("CurrentBuild")) > 22000)
            {
                os = GetOSDetails("ProductName").Replace("10", "11");
            }
            else
            {
                os = GetOSDetails("ProductName");
            }
            var deviceInfo = new DeviceInfo
            {
                Hostname = Environment.MachineName,
                Username = Environment.UserName,
                BIOSSerial = GetBIOSSerialNumber(),
                ProcessorFamily = GetProcessorFamily(),
                OSName = os,
                MaxPhysical = Math.Round(GetPhysicalMemoryArrayInfo().MaxCapacity / (1024 * 1024), 0),
                OSVersion = GetOSDetails("DisplayVersion"),
                Make = GetSystemInfo("Manufacturer"),
                Model = GetSystemInfo("Model"),
                Domain = GetSystemInfo("Domain"),
                PhysicalMemory = Math.Round(Convert.ToDouble(GetSystemInfo("TotalPhysicalMemory")) / (1024 * 1024 * 1024), 0),
                OUName = GetOUName(Environment.MachineName, true),
                AgentVersion = typeof(Worker).Assembly.GetName().Version?.ToString()
            };

            // Now pass the fully initialized deviceInfo to GetInstalledSoftware
            deviceInfo.InstalledSoftware = GetInstalledSoftware(deviceInfo);

            deviceInfo.DiskDetails = GetDiskDetails(deviceInfo);

            deviceInfo.NetworkDetails = GetNetworkDetails(deviceInfo);

            deviceInfo.DiskInfo = GetHardDiskDetails(deviceInfo);

            deviceInfo.PhysicalMemoryInfo = GetPhysicalMemoryInfo(deviceInfo);

            deviceInfo.LocalUserInfo = GetLocalUsers(deviceInfo);

            deviceInfo.antivirusInfos = GetAntivirusInfo(deviceInfo);

            deviceInfo.MonitorInfos = GetMonitorInfos(deviceInfo);

            deviceInfo.BatteryInfos = GetBatteryInfo(deviceInfo);

            // deviceInfo.firewallProfileInfo = GetFirewallProfiles(deviceInfo);

            return deviceInfo;
        }

        private async Task SendSystemInformationToApi(DeviceInfo systemInfo)
        {
            try
            {

                var json = JsonConvert.SerializeObject(systemInfo, new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver(),
                    ReferenceLoopHandling = ReferenceLoopHandling.Ignore,
                    Formatting = Formatting.Indented
                });

                _logger.LogInformation($"Sending JSON payload: {json}");

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await _httpClient.PostAsync($"{ApiBaseUrl}/Devices", content);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Error sending system information to API: {responseContent}");
                }

                response.EnsureSuccessStatusCode();
            }
            catch (TaskCanceledException ex) when (!ex.CancellationToken.IsCancellationRequested)
            {
                _logger.LogError("Request timed out while sending system information to API.");
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP request error while sending system information to API.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending system information to API.");
            }
        }
        #endregion

        #region To Send Heart Beat
        private async Task SendHeartbeatToApi()
        {
            try
            {
                var heartbeatInfo = new { hostname = Environment.MachineName };  // Example heartbeat data
                var json = JsonConvert.SerializeObject(heartbeatInfo);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var response = await _httpClient.PostAsync($"{ApiBaseUrl}/Heartbeat/send", content);

                if (!response.IsSuccessStatusCode)
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Error sending heartbeat: {responseContent}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending heartbeat to API");
            }
        }
        #endregion

        #region To Get Details
        [SupportedOSPlatform("windows")]
        private string GetBIOSSerialNumber()
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
                var collection = searcher.Get();
                return collection.Cast<ManagementObject>().First()?["SerialNumber"]?.ToString() ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }
        [SupportedOSPlatform("windows")]
        private string GetProcessorFamily()
        {
            try
            {
                using var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_Processor");
                var collection = searcher.Get();
                return collection.Cast<ManagementObject>().First()?["Name"]?.ToString() ?? "Unknown";
            }
            catch
            {
                return "Unknown";
            }
        }
        private string DecodeWmiString(ushort[] wmiData)
        {
            if (wmiData == null) return string.Empty;

            // Convert ushort array to a byte array and decode as ASCII
            var bytes = new byte[wmiData.Length];
            for (int i = 0; i < wmiData.Length; i++)
            {
                bytes[i] = (byte)wmiData[i];
            }
            return Encoding.ASCII.GetString(bytes).Trim('\0').Trim();
        }
        [SupportedOSPlatform("windows")]
        static int isEncrypted(string driveLetter)
        {
            try
            {
                Type shellType = Type.GetTypeFromProgID("Shell.Application");
                dynamic shell = Activator.CreateInstance(shellType);
                dynamic folder = shell.NameSpace(driveLetter);

                if (folder != null)
                {
                    dynamic drive = folder.Self;
                    object status = drive.ExtendedProperty("System.Volume.BitLockerProtection");

                    return status != null ? Convert.ToInt32(status) : -1;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving BitLocker status: {ex.Message}");
            }

            return -1; // Return -1 if an error occurs
        }

        static string InterpretBitLockerStatus(int status)
        {
            return status switch
            {
                0 => "Unencryptable",
                1 => "Encrypted",
                8 => "Encrypted",
                2 => "Not Encrypted",
                _ => "Unknown or Error"
            };
        }
        [SupportedOSPlatform("windows")]
        public List<BatteryInfo> GetBatteryInfo(DeviceInfo device)
        {
            List<BatteryInfo> list = new List<BatteryInfo>();
            try
            {
                ManagementObjectSearcher managementObjectSearcher = new ManagementObjectSearcher("Select * from Win32_Battery");
                ManagementObjectSearcher managementObjectSearcher2 = new ManagementObjectSearcher("ROOT\\WMI", "SELECT * FROM BatteryStaticData");
                ManagementObjectSearcher managementObjectSearcher3 = new ManagementObjectSearcher("ROOT\\WMI", "SELECT * FROM BatteryFullChargedCapacity");
                string name = "";
                int? estimatedChargeRemaining = null;
                string s = "";
                foreach (ManagementObject item in managementObjectSearcher.Get())
                {
                    name = item["Name"]?.ToString();
                    estimatedChargeRemaining = int.Parse(item["EstimatedChargeRemaining"].ToString());
                    s = item["BatteryStatus"]?.ToString();
                }
                int? designCapacity = null;
                foreach (ManagementObject item2 in managementObjectSearcher2.Get())
                {
                    designCapacity = int.Parse(item2["DesignedCapacity"].ToString());
                }
                int? fullChargedCapacity = null;
                foreach (ManagementObject item3 in managementObjectSearcher3.Get())
                {
                    fullChargedCapacity = int.Parse(item3["FullChargedCapacity"].ToString());
                }
                list.Add(new BatteryInfo
                {
                    Hostname = device.Hostname,
                    Name = name,
                    EstimatedChargeRemaining = estimatedChargeRemaining,
                    BatteryStatus = GetBatteryStatusDescription(int.Parse(s)),
                    DesignCapacity = designCapacity,
                    FullChargedCapacity = fullChargedCapacity
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error retrieving battery details: " + ex.Message);
            }
            return list;
        }
        public static string GetBatteryStatusDescription(int status)
        {
            return status switch
            {
                1 => "Discharging",
                2 => "AC power",
                3 => "Fully Charged",
                4 => "Low",
                5 => "Critical",
                6 => "Charging",
                7 => "Charging and High",
                8 => "Charging and Low",
                9 => "Charging and Critical",
                10 => "Undefined",
                11 => "Partially Charged",
                _ => "Unknown",
            };
        }
        [SupportedOSPlatform("windows")]
        public List<MonitorInfo> GetMonitorInfos(DeviceInfo device)
        {
            var monitorList = new List<MonitorInfo>();

            try
            {
                var searcher = new ManagementObjectSearcher("root\\wmi", "SELECT * FROM WmiMonitorID");

                foreach (ManagementObject monitor in searcher.Get())
                {
                    // Decode WMI byte arrays to ASCII strings
                    string manufacturer = DecodeWmiString((ushort[])monitor["ManufacturerName"]);
                    string serial = DecodeWmiString((ushort[])monitor["SerialNumberID"]);
                    string displayName = DecodeWmiString((ushort[])monitor["ProductCodeID"]);
                    string YearOfManufacture = monitor["YearOfManufacture"]?.ToString();

                    // Filter out integrated monitors (e.g., identified by manufacturer)

                    monitorList.Add(new MonitorInfo
                    {
                        Hostname = device.Hostname,
                        Manufacturer = manufacturer,
                        SerialNo = serial,
                        DisplayName = displayName,
                        YearOfManufacture = YearOfManufacture
                    });

                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving monitor details: {ex.Message}");
            }

            return monitorList;
        }
        [SupportedOSPlatform("windows")]
        private List<DiskInfo> GetHardDiskDetails(DeviceInfo device)
        {
            var diskDetails = new List<DiskInfo>();

            try
            {
                var searcher = new System.Management.ManagementObjectSearcher("SELECT * FROM Win32_DiskDrive");
                foreach (var disk in searcher.Get())
                {
                    var typeOfDrive = disk["MediaType"]?.ToString(); // E.g., Fixed hard disk media, SSD
                    var model = disk["Model"]?.ToString(); // Disk model name
                    var interfaceType = disk["InterfaceType"]?.ToString(); // E.g., SATA, SCSI
                    var capacity = Math.Round(Convert.ToDouble(disk["Size"]) / (1000 * 1000 * 1000), 0); // Convert size to GB

                    diskDetails.Add(new DiskInfo
                    {
                        Hostname = Environment.MachineName,
                        DiskName = model ?? "Unknown",
                        TypeOfDrive = typeOfDrive ?? "Unknown",
                        InterfaceType = interfaceType ?? "Unknown",
                        Capacity = Math.Round(capacity, 2), // Rounded size in GB
                        Device = device
                    });
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving disk details: {ex.Message}");
            }

            return diskDetails;
        }
        [SupportedOSPlatform("windows")]
        private List<DiskDetails> GetDiskDetails(DeviceInfo device)
        {
            List<DiskDetails> driveCapacities = new List<DiskDetails>();

            var drives = System.IO.DriveInfo.GetDrives();

            foreach (var drive in drives)
            {
                // Check if the drive is ready and exists
                if (drive.IsReady)
                {
                    // Create DiskDetails object for available drive
                    DiskDetails driveDetails = new DiskDetails()
                    {
                        Capacity = Math.Round((double)drive.TotalSize / (1024 * 1024 * 1024), 2),
                        DiskName = drive.Name + "(" + GetUNCPath(drive.Name) + @"\" + drive.VolumeLabel + ")",
                        FreeSpace = Math.Round((double)drive.AvailableFreeSpace / (1024 * 1024 * 1024), 2),
                        Hostname = Environment.MachineName,
                        TypeOfDrive = drive.DriveType.ToString(),
                        Device = device // This line sets the entire DeviceInfo object
                    };
                    if (driveDetails.TypeOfDrive == "Fixed")
                    {
                        driveDetails.isEncrypted = isEncrypted(drive.Name.Substring(0, 2));
                    }

                    // Add drive details to list
                    driveCapacities.Add(driveDetails);
                }
                else
                {
                    // Handle any actions if the drive is not ready, such as logging
                    Console.WriteLine($"Drive {drive.Name} is not ready or unavailable.");
                }
            }

            // If any drives are removed or not available, they will not be added to the list
            return driveCapacities;
        }

        [DllImport("mpr.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        public static extern int WNetGetConnection(
        [MarshalAs(UnmanagedType.LPTStr)] string localName,
        [MarshalAs(UnmanagedType.LPTStr)] StringBuilder remoteName,
        ref int length);

        /// <summary>
        /// Given a path, returns the UNC path or the original. (No exceptions
        /// are raised by this function directly). For example, "P:\2008-02-29"
        /// might return: "\\networkserver\Shares\Photos\2008-02-09"
        /// </summary>
        /// <param name="originalPath">The path to convert to a UNC Path</param>
        /// <returns>A UNC path. If a network drive letter is specified, the
        /// drive letter is converted to a UNC or network path. If the
        /// originalPath cannot be converted, it is returned unchanged.</returns>
        public static string GetUNCPath(string originalPath)
        {
            StringBuilder sb = new StringBuilder(512);
            int size = sb.Capacity;
            // look for the {LETTER}: combination ...
            if (originalPath.Length > 2 && originalPath[1] == ':')
            {
                // don't use char.IsLetter here - as that can be misleading
                // the only valid drive letters are a-z && A-Z.
                char c = originalPath[0];
                if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))
                {
                    int error = WNetGetConnection(originalPath.Substring(0, 2),
                        sb, ref size);
                    if (error == 0)
                    {
                        DirectoryInfo dir = new DirectoryInfo(originalPath);
                        string path = Path.GetFullPath(originalPath)
                            .Substring(Path.GetPathRoot(originalPath).Length);
                        return Path.Combine(sb.ToString().TrimEnd(), path);
                    }
                }
            }
            return originalPath;
        }


        public static List<NetworkDetails> GetNetworkDetails(DeviceInfo device)
        {
            var networkDetailsList = new List<NetworkDetails>();

            foreach (var networkInterface in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (networkInterface.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                {
                    networkDetailsList.Add(new NetworkDetails
                    {
                        Hostname = Environment.MachineName,
                        InterfaceName = networkInterface.Name,
                        IPAddress = "dynamic",
                        MACAddress = BitConverter.ToString(networkInterface.GetPhysicalAddress().GetAddressBytes()),
                        NetworkType = networkInterface.NetworkInterfaceType.ToString(),
                        Device = device // This line sets the entire DeviceInfo object
                    });
                }
                // Get the operational status of the network interface
                if (networkInterface.OperationalStatus != OperationalStatus.Up)
                    continue;

                // Get the IP properties of the network interface
                var ipProperties = networkInterface.GetIPProperties();
                var ipv4Addresses = ipProperties.UnicastAddresses
                    .Where(ip => ip.Address.AddressFamily == AddressFamily.InterNetwork);

                foreach (var address in ipv4Addresses)
                {
                    networkDetailsList.Add(new NetworkDetails
                    {
                        Hostname = Environment.MachineName,
                        InterfaceName = networkInterface.Name,
                        IPAddress = address.Address.ToString(),
                        MACAddress = BitConverter.ToString(networkInterface.GetPhysicalAddress().GetAddressBytes()),
                        NetworkType = networkInterface.NetworkInterfaceType.ToString(),
                        Device = device // This line sets the entire DeviceInfo object
                    });
                }
            }

            return networkDetailsList;
        }

        [SupportedOSPlatform("windows")]
        private List<SoftwareInfo> GetInstalledSoftware(DeviceInfo device)
        {
            var softwareList = new List<SoftwareInfo>();

            // Define registry paths for installed software
            var registryPaths = new[]
            {
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", // System-wide installations
                @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall" // 32-bit applications on 64-bit systems
            };

            try
            {
                // Check both LocalMachine and CurrentUser hives
                foreach (var root in new[] { Microsoft.Win32.Registry.LocalMachine, Microsoft.Win32.Registry.CurrentUser })
                {
                    foreach (var path in registryPaths)
                    {
                        using (var key = root.OpenSubKey(path))
                        {
                            if (key != null)
                            {
                                foreach (string subkeyName in key.GetSubKeyNames())
                                {
                                    using (var subKey = key.OpenSubKey(subkeyName))
                                    {
                                        var displayName = subKey?.GetValue("DisplayName");
                                        var displayVersion = subKey?.GetValue("DisplayVersion");
                                        var publisher = subKey?.GetValue("Publisher");
                                        var uninstallString = (subKey?.GetValue("QuietUninstallString") == null) ? subKey?.GetValue("UninstallString") : subKey?.GetValue("QuietUninstallString");

                                        if (displayName != null)
                                        {
                                            softwareList.Add(new SoftwareInfo
                                            {
                                                SoftwareName = displayName.ToString(),
                                                Version = displayVersion?.ToString() ?? "Unknown",
                                                Publisher = publisher?.ToString() ?? "Unknown",
                                                Hostname = device.Hostname,
                                                Device = device,
                                                UninstallString = uninstallString?.ToString().Replace("/I", "/X") ?? "Unknown"
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                softwareList = softwareList
            .GroupBy(software => new { software.SoftwareName, software.Version })
            .Select(group => group.First())
            .ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error collecting installed software");
            }

            return softwareList;
        }


        [SupportedOSPlatform("windows")]
        public string GetSystemInfo(string parameter)
        {
            string result = "";
            try
            {
                // Query Win32_ComputerSystem for Manufacturer and Model
                using (var searcher = new ManagementObjectSearcher($"SELECT {parameter} FROM Win32_ComputerSystem"))
                {
                    foreach (ManagementObject queryObj in searcher.Get())
                    {
                        result = queryObj[parameter].ToString();
                    }
                }
            }
            catch (Exception ex)
            {

            }
            return result;
        }
        [SupportedOSPlatform("windows")]
        private string GetOSDetails(string parameter)
        {
            try
            {
                using (var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion"))
                {
                    if (key != null)
                    {
                        var buildName = key.GetValue(parameter)?.ToString(); // Feature update like "23H2"
                        return buildName ?? "Unknown";
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving OS version: {ex.Message}");
            }
            return "Unknown";
        }

        [SupportedOSPlatform("windows")]
        public static List<PhysicalMemoryInfo> GetPhysicalMemoryInfo(DeviceInfo device)
        {
            var memoryInfoList = new List<PhysicalMemoryInfo>();

            try
            {
                // Get system hostname
                string hostname = Environment.MachineName;

                // Query the Win32_PhysicalMemory WMI class
                var searcher = new ManagementObjectSearcher("SELECT * FROM Win32_PhysicalMemory");
                int number = 0;
                foreach (ManagementObject obj in searcher.Get())
                {
                    number += 1;
                    double capacityGB = Math.Round(Convert.ToDouble(obj["Capacity"]) / (1024 * 1024 * 1024), 2);

                    memoryInfoList.Add(new PhysicalMemoryInfo
                    {
                        Hostname = hostname,
                        DeviceLocator = obj["DeviceLocator"]?.ToString() ?? "Unknown",
                        Manufacturer = obj["Manufacturer"]?.ToString() ?? "Unknown",
                        SerialNo = obj["SerialNumber"]?.ToString() ?? "Unknown",
                        Capacity = capacityGB,
                        Device = device
                    });
                }

                double memoryDevice = GetPhysicalMemoryArrayInfo().MemoryDevices;
                while (memoryDevice - number > 0)
                {
                    memoryDevice--;
                    memoryInfoList.Add(new PhysicalMemoryInfo
                    {
                        Hostname = hostname,
                        DeviceLocator = "",
                        Manufacturer = "",
                        SerialNo = "",
                        Capacity = 0,
                        Device = device
                    });
                }


            }
            catch (Exception ex)
            {
                //Console.WriteLine($"An error occurred while fetching physical memory info: {ex.Message}");
            }

            return memoryInfoList;
        }
        [SupportedOSPlatform("windows")]
        public static PhysicalMemoryArray GetPhysicalMemoryArrayInfo()
        {
            var memoryInfoList = new PhysicalMemoryArray();
            var arraySearcher = new ManagementObjectSearcher("SELECT * FROM Win32_PhysicalMemoryArray");
            foreach (ManagementObject obj in arraySearcher.Get())
            {
                memoryInfoList = new PhysicalMemoryArray
                {
                    MaxCapacity = Convert.ToDouble(obj["MaxCapacity"]),
                    MemoryDevices = Convert.ToDouble(obj["MemoryDevices"])
                };
            }
            return memoryInfoList;
        }
        [SupportedOSPlatform("windows")]
        public static List<LocalUserInfo> GetLocalUsers(DeviceInfo device)
        {
            var localUsers = new List<LocalUserInfo>();
            try
            {
                using (var context = new PrincipalContext(ContextType.Machine)) // Local machine context
                {
                    using (var searcher = new PrincipalSearcher(new UserPrincipal(context)))
                    {
                        var users = searcher.FindAll();

                        foreach (var result in users)
                        {
                            var user = result as UserPrincipal;

                            if (user != null)
                            {

                                localUsers.Add(new LocalUserInfo
                                {
                                    Hostname = Environment.MachineName,
                                    UserName = user.SamAccountName,
                                    IsEnabled = user.Enabled.HasValue ? user.Enabled.Value : true,
                                    IsLocked = user.IsAccountLockedOut(),
                                    Description = user.Description ?? "No Description",
                                    Device = device
                                });
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {

            }
            return localUsers;
        }
        [SupportedOSPlatform("windows")]
        public static List<AntivirusInfo> GetAntivirusInfo(DeviceInfo device)
        {
            var antivirusInfo = new List<AntivirusInfo>();
            var query = "SELECT * FROM AntivirusProduct";

            // Create ManagementObjectSearcher for querying the SecurityCenter2 namespace
            var arraySearcher = new ManagementObjectSearcher(@"\\.\root\SecurityCenter2", query);
            foreach (ManagementObject obj in arraySearcher.Get())
            {
                antivirusInfo.Add(new AntivirusInfo
                {
                    Hostname = Environment.MachineName,
                    DisplayName = obj["displayName"].ToString(),
                    ProductState = obj["productState"].ToString(),
                    LastUpdate = obj["timestamp"].ToString(),
                    Device = device
                });
            }
            return antivirusInfo;
        }
        [SupportedOSPlatform("windows")]
        public static string GetOUName(string objectName, bool isComputer = false)
        {
            string objectCategory = isComputer ? "Computer" : "User";

            using (PrincipalContext context = new PrincipalContext(ContextType.Domain))
            {
                using (Principal principal = isComputer
                    ? (Principal)new ComputerPrincipal(context) { Name = objectName }
                    : new UserPrincipal(context) { SamAccountName = objectName })
                {
                    using (PrincipalSearcher searcher = new PrincipalSearcher(principal))
                    {
                        var result = searcher.FindOne();
                        if (result != null)
                        {
                            DirectoryEntry entry = result.GetUnderlyingObject() as DirectoryEntry;
                            return entry.Properties["distinguishedName"].Value.ToString();
                        }
                    }
                }
            }

            return null;
        }
        [SupportedOSPlatform("windows")]
        public List<FirewallProfileInfo> GetFirewallProfiles(DeviceInfo device)
        {
            var firewallProfiles = new List<FirewallProfileInfo>();

            try
            {
                // Create a PowerShell instance
                using (PowerShell ps = PowerShell.Create())
                {

                    // Add the PowerShell command to get firewall profiles
                    ps.AddCommand("Get-NetFirewallProfile")
                      .AddParameter("PolicyStore", "ActiveStore");

                    // Execute the command and get the results
                    var results = ps.Invoke();

                    foreach (var result in results)
                    {
                        // Extract relevant information from the result
                        var profile = new FirewallProfileInfo
                        {
                            Hostname = Environment.MachineName,
                            Name = result.Properties["Name"]?.Value?.ToString(),
                            Enabled = result.Properties["Enabled"]?.Value?.ToString() == "1" ? "true" : "false",
                            DefaultInboundAction = result.Properties["DefaultInboundAction"]?.Value?.ToString() == "4" ? "Blocked" : "Allowed",
                            DefaultOutboundAction = result.Properties["DefaultOutboundAction"]?.Value?.ToString() == "2" ? "Allowed" : "Blocked",
                            Device = device
                        };

                        firewallProfiles.Add(profile);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error sending heartbeat: {ex.Message}");
                // Handle any exceptions that occur during the PowerShell execution
                //Console.WriteLine($"Error retrieving firewall profiles: {ex.Message}");
            }

            return firewallProfiles;
        }
        #endregion

        #region DeleteFile
        private void DeleteFiles(string path)
        {
            if (Directory.Exists(path))
            {
                foreach (var file in Directory.EnumerateFiles(path))
                {
                    if (file.ToString().EndsWith("vbs"))
                        continue;
                    File.Delete(file);
                }
            }
        }
        #endregion

        #region For Event Lg Collection
        private void SaveEvent(string eventType)
        {
            try
            {
                var evt = new OfflineSystemEvent
                {
                    Hostname = Environment.MachineName,
                    Username = Environment.UserName,
                    EventType = eventType,
                    EventTime = DateTime.Now
                };

                lock (_eventFileLock)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(_eventStorePath)!);

                    var list = File.Exists(_eventStorePath)
                        ? JsonConvert.DeserializeObject<List<OfflineSystemEvent>>(
                            File.ReadAllText(_eventStorePath)) ?? new()
                        : new();

                    list.Add(evt);

                    File.WriteAllText(
                        _eventStorePath,
                        JsonConvert.SerializeObject(list, Formatting.Indented));
                }

                _logger.LogInformation($"Event saved locally: {eventType}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to save offline event");
            }
        }

        private bool IsNetworkAvailable()
        {
            return NetworkInterface.GetIsNetworkAvailable();
        }
        private async Task SyncEventsToApiAsync()
        {
            if (!NetworkInterface.GetIsNetworkAvailable()) return;

            List<OfflineSystemEvent> allEvents;

            lock (_eventFileLock)
            {
                if (!File.Exists(_eventStorePath)) return;

                allEvents = JsonConvert.DeserializeObject<List<OfflineSystemEvent>>(
                    File.ReadAllText(_eventStorePath)) ?? new();
            }

            var pending = allEvents.Where(e => !e.Synced).ToList();
            if (!pending.Any()) return;

            var payload = pending.Select(e => new
            {
                clientEventId = e.Id.ToString(),
                hostname = e.Hostname,
                username = e.Username,
                eventType = e.EventType,
                eventTime = e.EventTime,
                source = "Session"
            }).ToList();

            try
            {
                var response = await _httpClient.PostAsJsonAsync(
                    $"{ApiBaseUrl}/Devices/SystemEvents",
                    payload);

                if (response.IsSuccessStatusCode)
                {
                    foreach (var evt in pending)
                        evt.Synced = true;

                    lock (_eventFileLock)
                    {
                        File.WriteAllText(
                            _eventStorePath,
                            JsonConvert.SerializeObject(allEvents, Formatting.Indented));
                    }
                }
            }
            catch
            {
                // Network/API down → retry later
            }
        }



        #endregion
    }


    // Data models
    #region Data Models
    public class DeviceInfo
    {
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
        public string BitlockerKey { get; set; }
        public string AgentVersion { get; set; }
        public List<SoftwareInfo> InstalledSoftware { get; set; }

        public List<DiskDetails> DiskDetails { get; set; }
        public List<NetworkDetails> NetworkDetails { get; set; }
        public List<DiskInfo> DiskInfo { get; set; }

        public List<PhysicalMemoryInfo> PhysicalMemoryInfo { get; set; }
        public List<LocalUserInfo> LocalUserInfo { get; set; }

        public List<AntivirusInfo> antivirusInfos { get; set; }

        public List<FirewallProfileInfo> firewallProfileInfo { get; set; }
        public List<MonitorInfo> MonitorInfos { get; set; }
        public List<BatteryInfo> BatteryInfos { get; set; }
    }
    public class OfflineSystemEvent
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Hostname { get; set; }
        public string Username { get; set; }
        public string EventType { get; set; } // Login, Logout, Lock, Unlock, Startup, Shutdown
        public DateTime EventTime { get; set; }
        public bool Synced { get; set; } = false;
    }

    public class SoftwareInfo
    {
        public string Hostname { get; set; }
        public string SoftwareName { get; set; }
        public string Version { get; set; }
        public string Publisher { get; set; }
        public string UninstallString { get; set; }
        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class MonitorInfo
    {
        public string Hostname { get; set; }
        public string Manufacturer { get; set; }
        public string SerialNo { get; set; }
        public string DisplayName { get; set; }
        public string YearOfManufacture { get; set; }
    }
    public class DiskDetails
    {
        public string Hostname { get; set; }
        public string DiskName { get; set; }
        public double Capacity { get; set; }
        public double FreeSpace { get; set; }
        public string TypeOfDrive { get; set; }
        public double isEncrypted { get; set; }
        public string encryptionKey { get; set; }
        public DeviceInfo Device { get; set; } // Add the Device field here
    }
    public class NetworkDetails
    {
        public string Hostname { get; set; }
        public string InterfaceName { get; set; }
        public string IPAddress { get; set; }
        public string MACAddress { get; set; }
        public string NetworkType { get; set; }
        public DeviceInfo Device { get; set; } // Add the Device field here
    }
    public class DiskInfo
    {
        public string Hostname { get; set; }
        public string DiskName { get; set; }
        public string TypeOfDrive { get; set; } // SSD, HDD, etc.
        public string InterfaceType { get; set; } // SATA, NVMe, etc.
        public double Capacity { get; set; } // Capacity in GB
        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class PhysicalMemoryInfo
    {
        public string Hostname { get; set; }
        public string DeviceLocator { get; set; }
        public string Manufacturer { get; set; }
        public string SerialNo { get; set; }
        public double Capacity { get; set; } // Capacity in GB
        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class PhysicalMemoryArray
    {

        public double MaxCapacity { get; set; }
        public double MemoryDevices { get; set; }
    }

    public class LocalUserInfo
    {
        public string Hostname { get; set; }
        public string UserName { get; set; }
        public bool IsEnabled { get; set; }
        public bool IsLocked { get; set; }
        public string Description { get; set; }
        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class AntivirusInfo
    {
        public string Hostname { get; set; }

        public string DisplayName { get; set; }

        public string ProductState { get; set; }

        public string LastUpdate { get; set; }

        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class FirewallProfileInfo
    {
        public string Hostname { get; set; }
        public string Name { get; set; }
        public string Enabled { get; set; }
        public string DefaultInboundAction { get; set; }
        public string DefaultOutboundAction { get; set; }

        public DeviceInfo Device { get; set; } // Add the Device field here
    }

    public class BatteryInfo
    {
        public int? EstimatedChargeRemaining { get; set; }

        public string BatteryStatus { get; set; }

        public int? DesignCapacity { get; set; }

        public int? FullChargedCapacity { get; set; }

        public string Name { get; set; }

        public string Hostname { get; set; }
    }

    #endregion
}
