using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DrawingPortal.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SerialNumbersAndModelBatteries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(name: "Serial", table: "Models", type: "int", nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<int>(name: "Serial", table: "Drawings", type: "int", nullable: false, defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "ModelBatteries",
                columns: table => new
                {
                    Id = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    ModelId = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
                    VoltageV = table.Column<int>(type: "int", nullable: false),
                    AhRatingId = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ModelBatteries", x => x.Id)
                        .Annotation("SqlServer:Clustered", false);
                    table.ForeignKey(
                        name: "FK_ModelBatteries_AhRatings_AhRatingId",
                        column: x => x.AhRatingId,
                        principalTable: "AhRatings",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ModelBatteries_Models_ModelId",
                        column: x => x.ModelId,
                        principalTable: "Models",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(name: "IX_Models_Serial", table: "Models", column: "Serial");
            migrationBuilder.CreateIndex(name: "IX_Drawings_Serial", table: "Drawings", column: "Serial");
            migrationBuilder.CreateIndex(name: "IX_ModelBatteries_AhRatingId", table: "ModelBatteries", column: "AhRatingId");
            migrationBuilder.CreateIndex(name: "IX_ModelBatteries_ModelId_VoltageV_AhRatingId", table: "ModelBatteries", columns: new[] { "ModelId", "VoltageV", "AhRatingId" }, unique: true);
            migrationBuilder.CreateIndex(name: "IX_ModelBatteries_CreatedAtUtc_Id", table: "ModelBatteries", columns: new[] { "CreatedAtUtc", "Id" }, unique: true)
                .Annotation("SqlServer:Clustered", true);

            // number the rows that already exist (oldest = 1)
            migrationBuilder.Sql("UPDATE m SET Serial = r.n FROM Models m JOIN (SELECT Id, ROW_NUMBER() OVER (ORDER BY CreatedAtUtc, Id) n FROM Models) r ON r.Id = m.Id");
            migrationBuilder.Sql("UPDATE d SET Serial = r.n FROM Drawings d JOIN (SELECT Id, ROW_NUMBER() OVER (ORDER BY CreatedAtUtc, Id) n FROM Drawings) r ON r.Id = d.Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ModelBatteries");
            migrationBuilder.DropIndex(name: "IX_Models_Serial", table: "Models");
            migrationBuilder.DropIndex(name: "IX_Drawings_Serial", table: "Drawings");
            migrationBuilder.DropColumn(name: "Serial", table: "Models");
            migrationBuilder.DropColumn(name: "Serial", table: "Drawings");
        }
    }
}
