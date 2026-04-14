using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SystemMonitorAPI.Migrations
{
    /// <inheritdoc />
    public partial class devicePortDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CONNECTED_PORT",
                table: "SMM_DEVICE",
                type: "NVARCHAR2(2000)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE",
                type: "NUMBER(10)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CONNECTED_SWITCH_IP",
                table: "SMM_DEVICE",
                type: "NVARCHAR2(2000)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CONNECTED_SWITCH_NAME",
                table: "SMM_DEVICE",
                type: "NVARCHAR2(2000)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CONNECTION_PROTOCOL",
                table: "SMM_DEVICE",
                type: "NVARCHAR2(2000)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PORT_LAST_SEEN",
                table: "SMM_DEVICE",
                type: "TIMESTAMP(7)",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_SMM_DEVICE_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE",
                column: "CONNECTED_SWITCH_ID");

            migrationBuilder.AddForeignKey(
                name: "FK_SMM_DEVICE_SMM_SWITCH_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE",
                column: "CONNECTED_SWITCH_ID",
                principalTable: "SMM_SWITCH",
                principalColumn: "SWITCHID");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SMM_DEVICE_SMM_SWITCH_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE");

            migrationBuilder.DropIndex(
                name: "IX_SMM_DEVICE_CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "CONNECTED_PORT",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "CONNECTED_SWITCH_ID",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "CONNECTED_SWITCH_IP",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "CONNECTED_SWITCH_NAME",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "CONNECTION_PROTOCOL",
                table: "SMM_DEVICE");

            migrationBuilder.DropColumn(
                name: "PORT_LAST_SEEN",
                table: "SMM_DEVICE");
        }
    }
}
