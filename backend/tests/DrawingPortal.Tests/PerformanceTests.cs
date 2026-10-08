using System.Diagnostics;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit.Abstractions;

namespace DrawingPortal.Tests;

/// <summary>Opt-in load test: set DP_PERF=1 (and DP_TEST_SQLSERVER for real numbers). Seeds 20,000 drawings and times the hot paths.</summary>
public class PerformanceTests(ApiFixture f, ITestOutputHelper output) : IClassFixture<ApiFixture>
{
    [Fact]
    public async Task Hot_paths_stay_fast_with_20000_drawings()
    {
        if (Environment.GetEnvironmentVariable("DP_PERF") != "1") return;
        var admin = await f.LoginAdminAsync();
        string etv = "", conn = "";
        await f.Scoped(async sp =>
        {
            var db = sp.GetRequiredService<AppDbContext>();
            etv = (await db.Models.FirstAsync(m => m.ModelName == "ETV 320")).Id; conn = (await db.Connectors.FirstAsync()).Id;
            var models = await db.Models.Select(m => m.Id).ToListAsync();
            var rnd = new Random(7);
            var sw = Stopwatch.StartNew();
            for (var b = 0; b < 40; b++)
            {
                var batch = new List<Drawing>(); var revs = new List<DrawingRevision>();
                for (var i = 0; i < 500; i++)
                {
                    var n = b * 500 + i;
                    var d = new Drawing { DrawingNumber = $"{10 + n / 1000000:00} {n / 1000 % 1000:000} {n % 1000:000} A", ModelId = models[rnd.Next(models.Count)], VoltageV = new[] { 24, 36, 48, 72, 80 }[rnd.Next(5)], AhValue = 100 + rnd.Next(30) * 25,
                        LengthMm = 600 + rnd.Next(900), WidthMm = 150 + rnd.Next(700), HeightMm = 400 + rnd.Next(500), ConnectorTypeId = conn };
                    batch.Add(d); revs.Add(new DrawingRevision { DrawingId = d.Id, RevisionNo = 1, DrawingNumber = d.DrawingNumber });
                }
                db.Drawings.AddRange(batch); db.Revisions.AddRange(revs); await db.SaveChangesAsync(); db.ChangeTracker.Clear();
            }
            output.WriteLine($"seeded 20,000 drawings in {sw.ElapsedMilliseconds} ms");
            return 0;
        });
        async Task<long> Time(string label, string url, int runs = 15)
        {
            await admin.GetAsync(url);   // warm
            var sw = Stopwatch.StartNew();
            for (var i = 0; i < runs; i++) (await admin.GetAsync(url)).EnsureSuccessStatusCode();
            var avg = sw.ElapsedMilliseconds / runs; output.WriteLine($"{label}: avg {avg} ms over {runs} calls"); return avg;
        }
        var total = (await admin.GetAsync("/api/drawings?pageSize=1").Ok<PagedResult<DrawingDto>>()).Total;
        output.WriteLine($"total drawings: {total}");
        var s1 = await Time("search exact+similar (48V, tolerance band)", $"/api/drawings/search?modelId={etv}&voltageV=48&ahValue=625&ahStandard=&lengthMm=1000&widthMm=400&heightMm=700&includeSimilar=true");
        var s2 = await Time("search no-match", $"/api/drawings/search?modelId={etv}&voltageV=48&ahValue=625&lengthMm=3000&widthMm=1500&heightMm=1500");
        var s3 = await Time("admin list page 1 (25 rows, sort updated)", "/api/drawings?pageSize=25");
        var s4 = await Time("admin list text search", "/api/drawings?q=ETV&pageSize=25");
        var s5 = await Time("admin list deep page 400 sorted by number", "/api/drawings?page=400&pageSize=25&sort=number&dir=asc");
        var s6 = await Time("by-number lookup", "/api/drawings/by-number?number=10%20005%20123%20A");
        var s7 = await Time("bootstrap (cached)", "/api/lookups/bootstrap");
        foreach (var t in new[] { s1, s2, s3, s4, s5, s6, s7 }) Assert.True(t < 400, $"slow call: {t} ms");
    }
}
