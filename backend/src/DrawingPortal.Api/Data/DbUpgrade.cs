using DrawingPortal.Api.Domain;
using Microsoft.EntityFrameworkCore;

namespace DrawingPortal.Api.Data;

/// <summary>
/// Idempotent start-up upgrade for databases created before serial numbers / model batteries existed.
/// SQL Server gets its schema from the EF migration; SQLite (local / trial) is patched here.
/// </summary>
public static class DbUpgrade
{
    public static async Task RunAsync(AppDbContext db, bool sqlite, ILogger log)
    {
        if (sqlite)
        {
            foreach (var table in new[] { "Models", "Drawings" })
            {
                var has = false;
                var conn = db.Database.GetDbConnection();
                if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                await using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $"SELECT COUNT(*) FROM pragma_table_info('{table}') WHERE name = 'Serial'";
                    has = Convert.ToInt32(await cmd.ExecuteScalarAsync()) > 0;
                }
                if (!has) await db.Database.ExecuteSqlRawAsync($"ALTER TABLE {table} ADD COLUMN Serial INTEGER NOT NULL DEFAULT 0");
            }
            try
            {
                await db.Database.ExecuteSqlRawAsync(@"CREATE TABLE IF NOT EXISTS ModelBatteries (
                    Id TEXT NOT NULL CONSTRAINT PK_ModelBatteries PRIMARY KEY,
                    ModelId TEXT NOT NULL, VoltageV INTEGER NOT NULL, AhRatingId TEXT NULL, CreatedAtUtc TEXT NOT NULL,
                    FOREIGN KEY (ModelId) REFERENCES Models (Id) ON DELETE CASCADE,
                    FOREIGN KEY (AhRatingId) REFERENCES AhRatings (Id) ON DELETE CASCADE)");
                await db.Database.ExecuteSqlRawAsync("CREATE UNIQUE INDEX IF NOT EXISTS IX_ModelBatteries_ModelId_VoltageV_AhRatingId ON ModelBatteries (ModelId, VoltageV, AhRatingId)");
                await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_ModelBatteries_AhRatingId ON ModelBatteries (AhRatingId)");
                await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_Models_Serial ON Models (Serial)");
                await db.Database.ExecuteSqlRawAsync("CREATE INDEX IF NOT EXISTS IX_Drawings_Serial ON Drawings (Serial)");
            }
            catch (Exception ex) { log.LogWarning(ex, "Could not upgrade the SQLite schema"); }
        }

        try
        {
            // serial numbers for rows that do not have one yet (oldest first)
            var models = await db.Models.Where(x => x.Serial == 0).ToListAsync();
            if (models.Count > 0)
            {
                var max = await db.Models.MaxAsync(x => (int?)x.Serial) ?? 0;
                foreach (var m in models.OrderBy(x => x.CreatedAtUtc).ThenBy(x => x.Id)) m.Serial = ++max;
                await db.SaveChangesAsync();
            }
            var drawings = await db.Drawings.IgnoreQueryFilters().Where(x => x.Serial == 0).ToListAsync();
            if (drawings.Count > 0)
            {
                var max = await db.Drawings.IgnoreQueryFilters().MaxAsync(x => (int?)x.Serial) ?? 0;
                foreach (var d in drawings.OrderBy(x => x.CreatedAtUtc).ThenBy(x => x.Id)) d.Serial = ++max;
                await db.SaveChangesAsync();
            }

            // first run only: link every model to the voltage / Ah ratings its existing drawings already use
            if (!await db.ModelBatteries.AnyAsync())
            {
                var rate = await db.AhRatings.AsNoTracking().ToListAsync();
                var combos = await db.Drawings.AsNoTracking().Select(d => new { d.ModelId, d.VoltageV, d.AhValue, d.AhStandard }).Distinct().ToListAsync();
                var seen = new HashSet<string>();
                foreach (var c in combos)
                {
                    var ah = rate.FirstOrDefault(r => r.Value == c.AhValue && r.Standard == c.AhStandard)?.Id;
                    foreach (var key in new[] { (string?)null, ah })
                        if (seen.Add($"{c.ModelId}|{c.VoltageV}|{key}")) db.ModelBatteries.Add(new ModelBattery { ModelId = c.ModelId, VoltageV = c.VoltageV, AhRatingId = key });
                }
                await db.SaveChangesAsync();
            }
        }
        catch (Exception ex) { log.LogWarning(ex, "Could not back-fill serial numbers / model batteries"); }
    }
}
