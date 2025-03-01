using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SMM_CREDENTIAL",
                columns: table => new
                {
                    CREDENTIALID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ENCRYPTEDPASSWORD = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_CREDENTIAL", x => x.CREDENTIALID);
                });

            migrationBuilder.CreateTable(
                name: "SMM_DEVICE",
                columns: table => new
                {
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: false),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STATUS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LASTUPDATED = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_DEVICE", x => x.HOSTNAME);
                });

            migrationBuilder.CreateTable(
                name: "SMM_SYSTEMINFO",
                columns: table => new
                {
                    SYSTEMID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ISACTIVE = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    LASTUPDATEDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SYSTEMINFO", x => x.SYSTEMID);
                });

            migrationBuilder.CreateTable(
                name: "SMM_UPDATEINFO",
                columns: table => new
                {
                    UPDATEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    UPDATENAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    FILEPATH = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    FILENAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PARAMETERS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CREATEDDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    ISACTIVE = table.Column<bool>(type: "NUMBER(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_UPDATEINFO", x => x.UPDATEID);
                });

            migrationBuilder.CreateTable(
                name: "SMM_ANTIVIRUSINFOS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    DISPLAYNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PRODUCTSTATE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LASTUPDATE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_ANTIVIRUSINFOS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_ANTIVIRUSINFOS_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_DISKDETAILS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    DISKNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CAPACITY = table.Column<double>(type: "BINARY_DOUBLE", nullable: false),
                    FREESPACE = table.Column<double>(type: "BINARY_DOUBLE", nullable: false),
                    TYPEOFDRIVE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ISENCRYPTED = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    ENCRYPTIONKEY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_DISKDETAILS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_DISKDETAILS_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_DISKINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    DISKNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    TYPEOFDRIVE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    INTERFACETYPE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CAPACITY = table.Column<double>(type: "BINARY_DOUBLE", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_DISKINFO", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_DISKINFO_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_FIREWALLPROFILEINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    NAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ENABLED = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DEFAULTINBOUNDACTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DEFAULTOUTBOUNDACTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_FIREWALLPROFILEINFO", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_FIREWALLPROFILEINFO_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_LOCALUSERINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ISENABLED = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    ISLOCKED = table.Column<bool>(type: "NUMBER(1)", nullable: false),
                    DESCRIPTION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_LOCALUSERINFO", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_LOCALUSERINFO_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_MONITORDETAIL",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    MANUFACTURER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SERIALNO = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DISPLAYNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    YEAROFMANUFACTURE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_MONITORDETAIL", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_MONITORDETAIL_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_NETWORKDETAIL",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    INTERFACENAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    IPADDRESS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MACADDRESS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    NETWORKTYPE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_NETWORKDETAIL", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_NETWORKDETAIL_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_PHYSICALMEMORYINFO",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    DEVICELOCATOR = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MANUFACTURER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    SERIALNO = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CAPACITY = table.Column<double>(type: "BINARY_DOUBLE", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_PHYSICALMEMORYINFO", x => x.ID);
                    table.ForeignKey(
                        name: "FK_SMM_PHYSICALMEMORYINFO_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_SOFTWAREDETAIL",
                columns: table => new
                {
                    SOFTWAREDETAILSID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: true),
                    SOFTWARENAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    VERSION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PUBLISHER = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SOFTWAREDETAIL", x => x.SOFTWAREDETAILSID);
                    table.ForeignKey(
                        name: "FK_SMM_SOFTWAREDETAIL_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME");
                });

            migrationBuilder.CreateTable(
                name: "SMM_SYSTEMDETAIL",
                columns: table => new
                {
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: false),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    BIOSSERIAL = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    PROCESSORFAMILY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MAXPHYSICAL = table.Column<double>(type: "BINARY_DOUBLE", nullable: false),
                    PHYSICALMEMORY = table.Column<double>(type: "BINARY_DOUBLE", nullable: false),
                    MAKE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    MODEL = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    OSNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    OSVERSION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DOMAIN = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    OUNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SYSTEMDETAIL", x => x.HOSTNAME);
                    table.ForeignKey(
                        name: "FK_SMM_SYSTEMDETAIL_SMM_DEVICE_HOSTNAME",
                        column: x => x.HOSTNAME,
                        principalTable: "SMM_DEVICE",
                        principalColumn: "HOSTNAME",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SMM_SYSTEMUPDATE",
                columns: table => new
                {
                    SYSTEMUPDATEID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SYSTEMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    UPDATEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    STATUS = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    STATUSMESSAGE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LASTATTEMPTDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_SYSTEMUPDATE", x => x.SYSTEMUPDATEID);
                    table.ForeignKey(
                        name: "FK_SMM_SYSTEMUPDATE_SMM_SYSTEMINFO_SYSTEMID",
                        column: x => x.SYSTEMID,
                        principalTable: "SMM_SYSTEMINFO",
                        principalColumn: "SYSTEMID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SMM_SYSTEMUPDATE_SMM_UPDATEINFO_UPDATEID",
                        column: x => x.UPDATEID,
                        principalTable: "SMM_UPDATEINFO",
                        principalColumn: "UPDATEID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "SMM_UPDATELOG",
                columns: table => new
                {
                    LOGID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    SYSTEMID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    UPDATEID = table.Column<int>(type: "NUMBER(10)", nullable: false),
                    LOGMESSAGE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    LOGDATE = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_UPDATELOG", x => x.LOGID);
                    table.ForeignKey(
                        name: "FK_SMM_UPDATELOG_SMM_SYSTEMINFO_SYSTEMID",
                        column: x => x.SYSTEMID,
                        principalTable: "SMM_SYSTEMINFO",
                        principalColumn: "SYSTEMID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SMM_UPDATELOG_SMM_UPDATEINFO_UPDATEID",
                        column: x => x.UPDATEID,
                        principalTable: "SMM_UPDATEINFO",
                        principalColumn: "UPDATEID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SMM_ANTIVIRUSINFOS_HOSTNAME",
                table: "SMM_ANTIVIRUSINFOS",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_DISKDETAILS_HOSTNAME",
                table: "SMM_DISKDETAILS",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_DISKINFO_HOSTNAME",
                table: "SMM_DISKINFO",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_FIREWALLPROFILEINFO_HOSTNAME",
                table: "SMM_FIREWALLPROFILEINFO",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_LOCALUSERINFO_HOSTNAME",
                table: "SMM_LOCALUSERINFO",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_MONITORDETAIL_HOSTNAME",
                table: "SMM_MONITORDETAIL",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_NETWORKDETAIL_HOSTNAME",
                table: "SMM_NETWORKDETAIL",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_PHYSICALMEMORYINFO_HOSTNAME",
                table: "SMM_PHYSICALMEMORYINFO",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SOFTWAREDETAIL_HOSTNAME",
                table: "SMM_SOFTWAREDETAIL",
                column: "HOSTNAME");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SYSTEMUPDATE_SYSTEMID",
                table: "SMM_SYSTEMUPDATE",
                column: "SYSTEMID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_SYSTEMUPDATE_UPDATEID",
                table: "SMM_SYSTEMUPDATE",
                column: "UPDATEID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_UPDATELOG_SYSTEMID",
                table: "SMM_UPDATELOG",
                column: "SYSTEMID");

            migrationBuilder.CreateIndex(
                name: "IX_SMM_UPDATELOG_UPDATEID",
                table: "SMM_UPDATELOG",
                column: "UPDATEID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_ANTIVIRUSINFOS");

            migrationBuilder.DropTable(
                name: "SMM_CREDENTIAL");

            migrationBuilder.DropTable(
                name: "SMM_DISKDETAILS");

            migrationBuilder.DropTable(
                name: "SMM_DISKINFO");

            migrationBuilder.DropTable(
                name: "SMM_FIREWALLPROFILEINFO");

            migrationBuilder.DropTable(
                name: "SMM_LOCALUSERINFO");

            migrationBuilder.DropTable(
                name: "SMM_MONITORDETAIL");

            migrationBuilder.DropTable(
                name: "SMM_NETWORKDETAIL");

            migrationBuilder.DropTable(
                name: "SMM_PHYSICALMEMORYINFO");

            migrationBuilder.DropTable(
                name: "SMM_SOFTWAREDETAIL");

            migrationBuilder.DropTable(
                name: "SMM_SYSTEMDETAIL");

            migrationBuilder.DropTable(
                name: "SMM_SYSTEMUPDATE");

            migrationBuilder.DropTable(
                name: "SMM_UPDATELOG");

            migrationBuilder.DropTable(
                name: "SMM_DEVICE");

            migrationBuilder.DropTable(
                name: "SMM_SYSTEMINFO");

            migrationBuilder.DropTable(
                name: "SMM_UPDATEINFO");
        }
    }
}
