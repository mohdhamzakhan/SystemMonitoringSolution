using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPriorityAndPatchSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MAXRETRIES",
                table: "SMM_UPDATEINFO",
                type: "NUMBER(10)",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "PRIORITY",
                table: "SMM_UPDATEINFO",
                type: "NUMBER(10)",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "UPDATETYPE",
                table: "SMM_UPDATEINFO",
                type: "NVARCHAR2(2000)",
                nullable: false,
                defaultValue: "Software");

            migrationBuilder.AddColumn<int>(
                name: "RETRYCOUNT",
                table: "SMM_SYSTEMUPDATE",
                type: "NUMBER(10)",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MAXRETRIES",
                table: "SMM_UPDATEINFO");

            migrationBuilder.DropColumn(
                name: "PRIORITY",
                table: "SMM_UPDATEINFO");

            migrationBuilder.DropColumn(
                name: "UPDATETYPE",
                table: "SMM_UPDATEINFO");

            migrationBuilder.DropColumn(
                name: "RETRYCOUNT",
                table: "SMM_SYSTEMUPDATE");
        }
    }
}
