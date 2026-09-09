using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class documentProcess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SMM_DOC_CLASSIFICATION",
                columns: table => new
                {
                    ID = table.Column<int>(type: "NUMBER(10)", nullable: false)
                        .Annotation("Oracle:Identity", "START WITH 1 INCREMENT BY 1"),
                    CLIENT_EVENT_ID = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    HOSTNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    USERNAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    APPLICATION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    DOCUMENT_NAME = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    DOCUMENT_PATH = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    DOCUMENT_GUID = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    ACTION_TYPE = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    PREVIOUS_CLASSIFICATION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true),
                    CLASSIFICATION = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    EVENT_TIME = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_DOC_CLASSIFICATION", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "SMM_DOC_CLASSIFICATION_SETTINGS",
                columns: table => new
                {
                    PROFILE_NAME = table.Column<string>(type: "NVARCHAR2(450)", nullable: false),
                    CONFIG_JSON = table.Column<string>(type: "NVARCHAR2(2000)", nullable: false),
                    UPDATED_AT = table.Column<DateTime>(type: "TIMESTAMP(7)", nullable: false),
                    UPDATED_BY = table.Column<string>(type: "NVARCHAR2(2000)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SMM_DOC_CLASSIFICATION_SETTINGS", x => x.PROFILE_NAME);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SMM_DOC_CLASSIFICATION");

            migrationBuilder.DropTable(
                name: "SMM_DOC_CLASSIFICATION_SETTINGS");
        }
    }
}
