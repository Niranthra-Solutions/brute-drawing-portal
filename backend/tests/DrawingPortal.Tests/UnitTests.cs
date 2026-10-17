using DrawingPortal.Api.Common;
using DrawingPortal.Api.Services;

namespace DrawingPortal.Tests;

public class NanoIdTests
{
    [Fact]
    public void Ids_have_prefix_length_and_safe_alphabet()
    {
        var id = NanoId.New(Ids.Drawing);
        Assert.StartsWith("drw_", id);
        Assert.Equal(4 + NanoId.DefaultSize, id.Length);
        Assert.Matches("^drw_[0-9a-z]{21}$", id);
    }

    [Fact]
    public void Ids_are_unique_in_bulk()
    {
        var set = new HashSet<string>(Enumerable.Range(0, 50_000).Select(_ => NanoId.New("usr")));
        Assert.Equal(50_000, set.Count);
    }
}

public class DrawingNumberFormatTests
{
    [Theory]
    [InlineData("25 600 001 A", true)]
    [InlineData("18 502 553 A", true)]
    [InlineData("25  600 001 a", true)]      // whitespace collapsed + upper-cased by Normalize
    [InlineData("25600001A", false)]
    [InlineData("25 60 001 A", false)]
    [InlineData("25 600 001", false)]
    [InlineData("25 600 001 AB", false)]
    [InlineData("AB 600 001 A", false)]
    [InlineData("", false)]
    public void Default_mask_matches_the_BRD_format(string input, bool expected) =>
        Assert.Equal(expected, DrawingNumberFormat.Default.IsMatch(input));

    [Fact]
    public void Custom_masks_work_and_unsafe_masks_are_rejected()
    {
        Assert.True(DrawingNumberFormat.TryParse("AA-####", out var f, out _));
        Assert.True(f!.IsMatch("ab-1234"));
        Assert.False(f.IsMatch("ab-123"));
        Assert.False(DrawingNumberFormat.TryParse("(a+)+$", out _, out var err));   // regex syntax is not a mask
        Assert.NotNull(err);
        Assert.False(DrawingNumberFormat.TryParse("", out _, out _));
        Assert.False(DrawingNumberFormat.TryParse("--", out _, out _));              // no tokens
    }
}

public class SuggestionEngineTests
{
    private static DrawingFacts D(string no, int v, int ah, string std, int l, int w, int h, string model = "m1", string make = "k1") =>
        new("id-" + no, no, model, make, v, ah, std, l, w, h);
    private static readonly Tolerance Tol = new(20, 10, 20);
    private static SearchCriteria C(int l = 1220, int w = 350, int h = 780, int ah = 620, string std = "DIN", int v = 48, string? model = "m1") =>
        new(model, "k1", v, ah, std, l, w, h);

    [Fact]
    public void Exact_requires_every_input_including_ah_standard()
    {
        var d = D("A", 48, 620, "DIN", 1220, 350, 780);
        Assert.True(SuggestionEngine.IsExact(d, C()));
        Assert.False(SuggestionEngine.IsExact(d, C(std: "")));            // 620 != 620(DIN)
        Assert.False(SuggestionEngine.IsExact(d, C(ah: 560)));
        Assert.False(SuggestionEngine.IsExact(d, C(h: 781)));
        Assert.False(SuggestionEngine.IsExact(d, C(model: "other")));
        Assert.False(SuggestionEngine.IsExact(d, C(v: 24)));
    }

    [Theory]
    [InlineData(1240, 360, 800, true)]     // exactly at +20 / +10 / +20 (inclusive)
    [InlineData(1200, 340, 760, true)]     // exactly at -20 / -10 / -20
    [InlineData(1241, 350, 780, false)]    // length 21 mm out
    [InlineData(1220, 361, 780, false)]    // width 11 mm out
    [InlineData(1220, 350, 801, false)]    // height 21 mm out
    public void Tolerance_band_is_inclusive_and_per_dimension(int l, int w, int h, bool inside) =>
        Assert.Equal(inside, SuggestionEngine.IsWithinTolerance(D("A", 48, 560, "", l, w, h), C(), Tol));

    [Fact]
    public void Voltage_must_match_but_ah_and_model_are_not_filters()
    {
        var other = D("B", 48, 100, "", 1220, 350, 780, model: "zzz");
        var wrongVoltage = D("C", 24, 620, "DIN", 1220, 350, 780);
        var ranked = SuggestionEngine.Rank([other, wrongVoltage], C(), Tol, 50);
        Assert.Single(ranked);
        Assert.Equal("B", ranked[0].Drawing.DrawingNumber);
    }

    [Fact]
    public void Brd_annexure_example_returns_all_six_ranked_closest_first()
    {
        // BRD 1.9/1.10: input 1220 x 350 x 780, 48 V, 620(DIN)
        var all = new[]
        {
            D("18 502 553 A", 48, 560, "", 1223, 353, 787), D("18 502 279 A", 48, 620, "", 1220, 350, 785), D("17 500 614 A", 48, 620, "DIN", 1220, 350, 784),
            D("17 500 695 A", 48, 620, "DIN", 1220, 352, 784), D("17 500 694 A", 48, 620, "DIN", 1220, 352, 784), D("17 500 965 A", 48, 620, "DIN", 1210, 342, 770),
            D("21 600 549 A", 48, 775, "", 1220, 420, 780),   // width 70 mm away -> excluded
        };
        var ranked = SuggestionEngine.Rank(all, C(), Tol, 50);
        Assert.Equal(["17 500 614 A", "18 502 279 A", "17 500 694 A", "17 500 695 A", "18 502 553 A", "17 500 965 A"], ranked.Select(r => r.Drawing.DrawingNumber));
        Assert.True(ranked.All(r => r.FitPercent is >= 0 and <= 100));
        Assert.True(ranked[0].FitPercent > ranked[^1].FitPercent);
    }

    [Fact]
    public void Same_model_and_same_ah_break_ties()
    {
        var a = D("A", 48, 560, "", 1220, 350, 780, model: "x");
        var b = D("B", 48, 620, "DIN", 1220, 350, 780, model: "m1");
        var ranked = SuggestionEngine.Rank([a, b], C(), Tol, 50);
        Assert.Equal("B", ranked[0].Drawing.DrawingNumber);   // identical dimensions: same model + same Ah wins
        Assert.Equal(100, ranked[0].FitPercent);
    }

    [Fact]
    public void Zero_tolerance_means_exact_dimension_only_and_max_is_respected()
    {
        var zero = new Tolerance(0, 0, 0);
        var hit = D("A", 48, 560, "", 1220, 350, 780); var miss = D("B", 48, 560, "", 1221, 350, 780);
        Assert.Equal(["A"], SuggestionEngine.Rank([hit, miss], C(), zero, 50).Select(r => r.Drawing.DrawingNumber));
        var many = Enumerable.Range(0, 20).Select(i => D($"N{i:00}", 48, 560, "", 1220, 350, 780)).ToList();
        Assert.Equal(5, SuggestionEngine.Rank(many, C(), Tol, 5).Count);
    }
}
