using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using System.DirectoryServices.AccountManagement;
using System.IdentityModel.Tokens.Jwt;
using System.Runtime.Versioning;
using System.Security.Claims;
using System.Text;
using SystemMonitorAPI.Model;

namespace SystemMonitorAPI.Controllers
{
    [Route("api/auth")]
    [ApiController]
    [EnableCors("AllowAll")]
    public class AuthenticationController : ControllerBase
    {
        private readonly IConfiguration _config;
        public AuthenticationController(IConfiguration config)
        {
            _config = config;
        }
        [SupportedOSPlatform("windows")]
        [HttpPost("login")]
        public IActionResult LoginWithAD([FromBody] Login loginRequest)
        {
            if (loginRequest == null || string.IsNullOrEmpty(loginRequest.username) || string.IsNullOrEmpty(loginRequest.password)) { return BadRequest("Invalid Credentials"); }
            var userRole = AuthenticateUserWithAD(loginRequest.username,loginRequest.password);
            if (userRole == null) { return Unauthorized("Invalid username or password"); }
            var token = GenerateJwtToken(loginRequest.username, userRole);
            return Ok(new { token });
        }
        [SupportedOSPlatform("windows")]
        private string AuthenticateUserWithAD(string username, string password)
        {
            string domain = _config["ActiveDirectory:Domain"];

            using (var context = new PrincipalContext(ContextType.Domain, domain))
            {
                bool isValid = context.ValidateCredentials(username, password);
                if (!isValid)
                {
                    return null;
                }

                var user = UserPrincipal.FindByIdentity(context, username);
                if (user == null)
                {
                    return null;
                }

                // Assign roles based on AD group membership
                if (user.IsMemberOf(context, IdentityType.Name, "Sanand-IT") || user.IsMemberOf(context, IdentityType.Name, "MEAI-IT"))
                {
                    return "Admin";
                }
                return "User";
            }
        }
        private string GenerateJwtToken(string username, string role)
        {
            var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]));
            var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role)
        };

            var token = new JwtSecurityToken(
                _config["Jwt:Issuer"],
                _config["Jwt:Audience"],
                claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
