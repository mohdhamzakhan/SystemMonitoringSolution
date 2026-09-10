using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPriorityAndPatchSupport1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "TARGETVERSION",
                table: "SMM_UPDATEINFO",
                type: "NVARCHAR2(2000)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TARGETVERSION",
                table: "SMM_UPDATEINFO");
        }
    }
}
