using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class systemEvent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ISLOCAL",
                table: "SMM_UPDATEINFO",
                type: "NUMBER(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "ENDDATE",
                table: "SMM_SYSTEMDETAIL",
                type: "TIMESTAMP(7)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PRODUCTID",
                table: "SMM_SYSTEMDETAIL",
                type: "NVARCHAR2(2000)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "STARTDATE",
                table: "SMM_SYSTEMDETAIL",
                type: "TIMESTAMP(7)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SMM_BATTERYINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    ESTIMATEDCHARGE = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    BATTERYSTATUS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DESIGNCAPACITY = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    FULLCHARGEDCAPACITY = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", maxLength: 450, nullable: true),
                    NAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_BATTERYINFO", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_BATTERYINFO_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SMM_SYSTEMEVENTINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CLIENT_EVENT_ID = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    EVENTTYPE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    EVENTTIME = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    SOURCE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SYSTEMEVENTINFO", x => x.ID);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SMM_BATTERYINFO_HOSTNAME",
                table: "SMM_BATTERYINFO",
                column: "HOSTNAME");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_BATTERYINFO");

            migrationBuilder.DropTable(
                name: "SMM_SYSTEMEVENTINFO");

            migrationBuilder.DropColumn(
                name: "ISLOCAL",
                table: "SMM_UPDATEINFO");

            migrationBuilder.DropColumn(
                name: "ENDDATE",
                table: "SMM_SYSTEMDETAIL");

            migrationBuilder.DropColumn(
                name: "PRODUCTID",
                table: "SMM_SYSTEMDETAIL");

            migrationBuilder.DropColumn(
                name: "STARTDATE",
                table: "SMM_SYSTEMDETAIL");
        }
    }
}
