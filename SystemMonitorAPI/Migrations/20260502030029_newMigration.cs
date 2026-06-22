using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class newMigration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
          
            migrationBuilder.AddForeignKey(
                name: "FK_SMM_DEVICE_SMM_SWITCH_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE",
                column: "CONNECTED_SWITCH_ID",
                principalTable: "SMM_SWITCH",
                principalColumn: "SWITCHID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SMM_DEVICE_SMM_SWITCH_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE");

            migrationBuilder.AddForeignKey(
                name: "FK_SMM_DEVICE_SMM_SWITCH_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE",
                column: "CONNECTED_SWITCH_ID",
                principalTable: "SMM_SWITCH",
                principalColumn: "SWITCHID");
        }
    }
}
