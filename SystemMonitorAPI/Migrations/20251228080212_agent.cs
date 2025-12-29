using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class agent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AGENTVERSION",
                table: "SMM_DEVICE",
                type: "NVARCHAR2(2000)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AGENTVERSION",
                table: "SMM_DEVICE");
        }
    }
}
