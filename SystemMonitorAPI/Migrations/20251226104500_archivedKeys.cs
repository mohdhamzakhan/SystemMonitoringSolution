using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class archivedKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ARCHIVED",
                table: "SMM_BITLOCKERKEY",
                type: "NUMBER(1)",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ARCHIVED",
                table: "SMM_BITLOCKERKEY");
        }
    }
}
