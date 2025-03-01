using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class bitlockerKey_Foreign : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "HOSTNAME",
                table: "SMM_BITLOCKERKEY",
                type: "NVARCHAR2(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "NVARCHAR2(2000)");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_BITLOCKERKEY_HOSTNAME",
                table: "SMM_BITLOCKERKEY",
                column: "HOSTNAME");

            migrationBuilder.AddForeignKey(
                name: "FK_SMM_BITLOCKERKEY_SMM_DEVICE_HOSTNAME",
                table: "SMM_BITLOCKERKEY",
                column: "HOSTNAME",
                principalTable: "SMM_DEVICE",
                principalColumn: "HOSTNAME",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SMM_BITLOCKERKEY_SMM_DEVICE_HOSTNAME",
                table: "SMM_BITLOCKERKEY");

            migrationBuilder.DropIndex(
                name: "IX_SMM_BITLOCKERKEY_HOSTNAME",
                table: "SMM_BITLOCKERKEY");

            migrationBuilder.AlterColumn<string>(
                name: "HOSTNAME",
                table: "SMM_BITLOCKERKEY",
                type: "NVARCHAR2(2000)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "NVARCHAR2(450)");
        }
    }
}
