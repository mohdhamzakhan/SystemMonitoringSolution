using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class isencryptedChange1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<double>(
                name: "ISENCRYPTED",
                table: "SMM_DISKDETAILS",
                type: "BINARY_DOUBLE",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "NUMBER(1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<bool>(
                name: "ISENCRYPTED",
                table: "SMM_DISKDETAILS",
                type: "NUMBER(1)",
                nullable: false,
                oldClrType: typeof(double),
                oldType: "BINARY_DOUBLE");
        }
    }
}
