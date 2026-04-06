using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class vulneability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SMM_VULNERABILITY",
                columns: table => new
                {
                    VULNERABILITYID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CVE_ID = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SEVERITY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SCORE = table.Column<double>(type: "BINARY_DOUBLE", nullable: true),
                    PUBLISHED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    SOFTWAREDETAILSID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_VULNERABILITY", x => x.VULNERABILITYID);
                    table.ForeignKey(
                        name: "FK_SMM_VULNERABILITY_SMM_SOFTWAREDETAIL_SOFTWAREDETAILSID",
                        column: x => x.SOFTWAREDETAILSID,
                        principalTable: "SMM_SOFTWAREDETAIL",
                        principalColumn: "SOFTWAREDETAILSID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SMM_VULNERABILITY_CVE_ID_SOFTWAREDETAILSID",
                table: "SMM_VULNERABILITY",
                columns: new[] { "CVE_ID", "SOFTWAREDETAILSID" },
                unique: true,
                filter: "\"CVE_ID\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_VULNERABILITY_SOFTWAREDETAILSID",
                table: "SMM_VULNERABILITY",
                column: "SOFTWAREDETAILSID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_VULNERABILITY");
        }
    }
}
