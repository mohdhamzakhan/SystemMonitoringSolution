using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class switchs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "SMM_NEIGHBOR_SEQ",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SMM_SWITCH_SEQ",
                incrementBy: 10);

            migrationBuilder.CreateSequence(
                name: "SMM_SWITCHPORT_SEQ",
                incrementBy: 10);

            migrationBuilder.CreateTable(
                name: "SMM_SWITCH",
                columns: table => new
                {
                    SWITCHID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    IPADDRESS = table.Column<string>(type: "NVARCHAR2(45)", maxLength: 45, nullable: true),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    SYSDESCR = table.Column<string>(type: "NVARCHAR2(1024)", maxLength: 1024, nullable: true),
                    VENDOR = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    MODEL = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    SWITCHLAYER = table.Column<string>(type: "NVARCHAR2(10)", maxLength: 10, nullable: true),
                    MACADDRESS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    FIRMWAREVERSION = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    LOCATION = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    CONTACT = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    UPTIME = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    POOLNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    ISREACHABLE = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    ISACTIVE = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    FIRSTDISCOVERED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true),
                    LASTSCANDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SWITCH", x => x.SWITCHID);
                });

            migrationBuilder.CreateTable(
                name: "SMM_SWITCHPORT",
                columns: table => new
                {
                    PORTID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    SWITCHID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    IFINDEX = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    PORTNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    PORTALIAS = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    IFTYPE = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    MACADDRESS = table.Column<string>(type: "NVARCHAR2(20)", maxLength: 20, nullable: true),
                    SPEEDMBPS = table.Column<long>(type: "NUMBER(19)", nullable: true),
                    ADMINSTATUS = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    OPERSTATUS = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    PORTIP = table.Column<string>(type: "NVARCHAR2(45)", maxLength: 45, nullable: true),
                    VLANID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    ISUPLINK = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SWITCHPORT", x => x.PORTID);
                    table.ForeignKey(
                        name: "FK_SMM_SWITCHPORT_SMM_SWITCH_SWITCHID",
                        column: x => x.SWITCHID,
                        principalTable: "SMM_SWITCH",
                        principalColumn: "SWITCHID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SMM_SWITCHNEIGHBOR",
                columns: table => new
                {
                    NEIGHBORID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LOCALSWITCHID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LOCALPORTID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    LOCALPORTNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    REMOTESWITCHID = table.Column<int>(type: "NUMBER(10)", nullable: true),
                    REMOTESYSNAME = table.Column<string>(type: "NVARCHAR2(255)", maxLength: 255, nullable: true),
                    REMOTEIP = table.Column<string>(type: "NVARCHAR2(45)", maxLength: 45, nullable: true),
                    REMOTEPORTNAME = table.Column<string>(type: "NVARCHAR2(100)", maxLength: 100, nullable: true),
                    REMOTECHASSISID = table.Column<string>(type: "NVARCHAR2(50)", maxLength: 50, nullable: true),
                    PROTOCOL = table.Column<string>(type: "NVARCHAR2(10)", maxLength: 10, nullable: true),
                    LASTSEEN = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SWITCHNEIGHBOR", x => x.NEIGHBORID);
                    table.ForeignKey(
                        name: "FK_SMM_SWITCHNEIGHBOR_SMM_SWITCHPORT_LOCALPORTID",
                        column: x => x.LOCALPORTID,
                        principalTable: "SMM_SWITCHPORT",
                        principalColumn: "PORTID",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_SMM_SWITCHNEIGHBOR_SMM_SWITCH_LOCALSWITCHID",
                        column: x => x.LOCALSWITCHID,
                        principalTable: "SMM_SWITCH",
                        principalColumn: "SWITCHID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SMM_SWITCHNEIGHBOR_SMM_SWITCH_REMOTESWITCHID",
                        column: x => x.REMOTESWITCHID,
                        principalTable: "SMM_SWITCH",
                        principalColumn: "SWITCHID",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SWITCH_IPADDRESS",
                table: "SMM_SWITCH",
                column: "IPADDRESS",
                unique: true,
                filter: "\"IPADDRESS\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SWITCHNEIGHBOR_LOCALPORTID",
                table: "SMM_SWITCHNEIGHBOR",
                column: "LOCALPORTID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SWITCHNEIGHBOR_LOCALSWITCHID",
                table: "SMM_SWITCHNEIGHBOR",
                column: "LOCALSWITCHID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SWITCHNEIGHBOR_REMOTESWITCHID",
                table: "SMM_SWITCHNEIGHBOR",
                column: "REMOTESWITCHID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SWITCHPORT_SWITCHID_IFINDEX",
                table: "SMM_SWITCHPORT",
                columns: new[] { "SWITCHID", "IFINDEX" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_SWITCHNEIGHBOR");

            migrationBuilder.DropTable(
                name: "SMM_SWITCHPORT");

            migrationBuilder.DropTable(
                name: "SMM_SWITCH");

            migrationBuilder.DropSequence(
                name: "SMM_NEIGHBOR_SEQ");

            migrationBuilder.DropSequence(
                name: "SMM_SWITCH_SEQ");

            migrationBuilder.DropSequence(
                name: "SMM_SWITCHPORT_SEQ");
        }
    }
}
