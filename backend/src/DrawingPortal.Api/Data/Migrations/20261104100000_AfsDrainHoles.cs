using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DrawingPortal.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AfsDrainHoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "AfsDrain", table: "Drawings", type: "nvarchar(40)", maxLength: 40, nullable: true);
            migrationBuilder.AddColumn<string>(name: "AfsDrain", table: "Requests", type: "nvarchar(20)", maxLength: 20, nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "AfsDrain", table: "Drawings");
            migrationBuilder.DropColumn(name: "AfsDrain", table: "Requests");
        }
    }
}