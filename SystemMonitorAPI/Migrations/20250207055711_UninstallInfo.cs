using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class UninstallInfo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SMM_UNINSTALLINFO",
                columns: table => new
                {
                    UNINSTALLID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SYSTEMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    APPLICATIONID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SOFTWARENAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ACTIVE = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    UPDATEDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    REMARKS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_UNINSTALLINFO", x => x.UNINSTALLID);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_UNINSTALLINFO");
        }
    }
}
