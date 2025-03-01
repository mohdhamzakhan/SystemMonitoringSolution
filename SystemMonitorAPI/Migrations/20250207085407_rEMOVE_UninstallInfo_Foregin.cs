using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class rEMOVE_UninstallInfo_Foregin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SMM_UNINSTALLINFO_SMM_SOFTWAREDETAIL_APPLICATIONID",
                table: "SMM_UNINSTALLINFO");

            migrationBuilder.DropIndex(
                name: "IX_SMM_UNINSTALLINFO_APPLICATIONID",
                table: "SMM_UNINSTALLINFO");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_SMM_UNINSTALLINFO_APPLICATIONID",
                table: "SMM_UNINSTALLINFO",
                column: "APPLICATIONID");

            migrationBuilder.AddForeignKey(
                name: "FK_SMM_UNINSTALLINFO_SMM_SOFTWAREDETAIL_APPLICATIONID",
                table: "SMM_UNINSTALLINFO",
                column: "APPLICATIONID",
                principalTable: "SMM_SOFTWAREDETAIL",
                principalColumn: "SOFTWAREDETAILSID",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
