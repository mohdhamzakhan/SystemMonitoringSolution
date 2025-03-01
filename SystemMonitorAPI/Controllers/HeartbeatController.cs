using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HeartbeatController : ControllerBase
    {
        private readonly IDeviceService _deviceService;

        public HeartbeatController(IDeviceService deviceService)
        {
            _deviceService = deviceService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> ReceiveHeartbeat([FromBody] HeartbeatRequest request)
        {
            try
            {
                // Update the last heartbeat timestamp for the device
                await _deviceService.UpdateLastHeartbeatAsync(request.Hostname, DateTime.Now);
                await _deviceService.CheckAndUpdateDeviceStatusesAsync();

                return Ok(new { Message = "Heartbeat received successfully" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Message = ex.Message });
            }
        }
    }

    public class HeartbeatRequest
    {
        public string Hostname { get; set; }
    }

}
