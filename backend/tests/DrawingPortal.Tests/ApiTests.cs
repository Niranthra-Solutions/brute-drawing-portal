using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DrawingPortal.Api.Common;
using DrawingPortal.Api.Data;
using DrawingPortal.Api.Domain;
using DrawingPortal.Api.Dtos;
using DrawingPortal.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using MiniExcelLibs;

namespace DrawingPortal.Tests;

public class ApiTests(ApiFixture f) : IClassFixture<ApiFixture>
{
    private static readonly byte[] Png = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
    private static byte[] Pdf(string t) => SamplePdf.Create(t, "test");

    private static async Task<BootstrapDto> Boot(HttpClient c) => await c.GetAsync("/api/lookups/bootstrap").Ok<BootstrapDto>();
    private static string Model(BootstrapDto b, string name) => b.Models.First(m => m.Name == name).Id;
    private static string Conn(BootstrapDto b, string name) => b.Connectors.First(m => m.Name == name).Id;
    private static string SearchUrl(string modelId, int v, int ah, string std, int l, int w, int h, bool similar = false) =>
        $"/api/drawings/search?modelId={modelId}&voltageV={v}&ahValue={ah}&ahStandard={std}&lengthMm={l}&widthMm={w}&heightMm={h}&includeSimilar={similar.ToString().ToLower()}";

    private static async Task<UploadedFileDto> UploadDrawing(HttpClient admin, string title) =>
        await admin.PostAsync("/api/files/drawings", HttpExt.File(title.Replace(' ', '_') + ".pdf", Pdf(title))).Ok<UploadedFileDto>();

    private async Task<DrawingDetailDto> CreateDrawing(HttpClient admin, string number, string modelId, string connId, int v = 48, int ah = 560, string std = "", int l = 1500, int w = 500, int h = 800, string? requestId = null)
    {
        var up = await UploadDrawing(admin, "Drawing " + number);
        return await admin.PostAsJsonAsync("/api/drawings", new { drawingNumber = number, modelId, voltageV = v, ahValue = ah, ahStandard = std, lengthMm = l, widthMm = w, heightMm = h, connectorTypeId = connId, fileId = up.Id, requestId }).Ok<DrawingDetailDto>();
    }

    // ------------------------------------------------------------------ security basics
    [Fact]
    public async Task Anonymous_calls_are_rejected_and_state_changes_need_the_anti_forgery_header()
    {
        var anon = f.NewClient();
        (await anon.GetAsync("/api/lookups/bootstrap")).StatusCode.Should401();
        (await anon.GetAsync("/api/drawings")).StatusCode.Should401();
        var noHeader = f.CreateClient(new() { HandleCookies = true });
        (await noHeader.PostAsJsonAsync("/api/auth/otp/request", new { email = "x@y.com" })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var r = await anon.GetAsync("/health");
        r.StatusCode.ShouldBe(HttpStatusCode.OK);
        r.Headers.GetValues("X-Content-Type-Options").Single().ShouldBe("nosniff");
        r.Headers.GetValues("X-Frame-Options").Single().ShouldBe("SAMEORIGIN");
        (await anon.GetAsync("/api/does-not-exist")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Otp_login_rejects_bad_codes_never_reveals_accounts_and_supports_refresh_and_logout()
    {
        var c = f.NewClient();
        var known = await c.PostAsJsonAsync("/api/auth/otp/request", new { email = ApiFixture.AdminEmail });
        var unknown = await c.PostAsJsonAsync("/api/auth/otp/request", new { email = "nobody@nowhere.test" });
        (await known.Content.ReadAsStringAsync()).ShouldBe(await unknown.Content.ReadAsStringAsync());   // identical answer
        (await c.PostAsJsonAsync("/api/auth/otp/verify", new { email = ApiFixture.AdminEmail, code = "000000" })).StatusCode.Should401();
        (await c.PostAsJsonAsync("/api/auth/otp/verify", new { email = ApiFixture.AdminEmail, code = "12" })).StatusCode.ShouldBe((HttpStatusCode)422);
        var me = await c.PostAsJsonAsync("/api/auth/otp/verify", new { email = ApiFixture.AdminEmail, code = "123456" }).Ok<UserDto>();
        me.Role.ShouldBe("Admin");
        (await c.GetAsync("/api/auth/me")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await c.PostAsync("/api/auth/refresh", null)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await c.PostAsync("/api/auth/logout", null)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await c.PostAsync("/api/auth/refresh", null)).StatusCode.Should401();
        (await c.GetAsync("/api/auth/me")).StatusCode.Should401();
    }

    [Fact]
    public async Task Bootstrap_contains_master_data_and_supports_etag_revalidation()
    {
        var c = await f.LoginAdminAsync();
        var r = await c.GetAsync("/api/lookups/bootstrap");
        var b = JsonSerializer.Deserialize<BootstrapDto>(await r.Content.ReadAsStringAsync(), ApiFixture.Json)!;
        b.Models.ShouldContain(m => m.Name == "ETV 320");
        b.AhRatings.ShouldContain(a => a.Label == "620(DIN)");
        b.Tolerance.ShouldBe(new ToleranceDto(20, 10, 20));
        var etag = r.Headers.ETag!.Tag;
        var again = new HttpRequestMessage(HttpMethod.Get, "/api/lookups/bootstrap"); again.Headers.TryAddWithoutValidation("If-None-Match", etag);
        (await c.SendAsync(again)).StatusCode.ShouldBe(HttpStatusCode.NotModified);
    }

    // ------------------------------------------------------------------ search = BRD acceptance
    [Fact]
    public async Task Search_follows_the_BRD_standard_and_non_standard_rules()
    {
        var c = await f.LoginAdminAsync(); var b = await Boot(c); var etv = Model(b, "ETV 320");

        var exact = await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 1220, 350, 784)).Ok<SearchResultDto>();
        exact.Mode.ShouldBe("Standard");
        exact.Exact.Select(d => d.DrawingNumber).ShouldBe(["17 500 614 A"]);
        exact.Similar.ShouldBeEmpty();                                     // BRD 1.8: suggestions only when no exact match

        var withSimilar = await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 1220, 350, 784, similar: true)).Ok<SearchResultDto>();
        withSimilar.Exact.Count.ShouldBe(1);
        withSimilar.Similar.ShouldNotContain(s => s.Drawing.DrawingNumber == "17 500 614 A");
        withSimilar.Similar.Count.ShouldBe(5);

        var near = await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 1220, 350, 780)).Ok<SearchResultDto>();   // BRD 1.9 input
        near.Mode.ShouldBe("NonStandard");
        near.Note.ShouldContain("closest dimension tolerances");
        near.Similar.Select(s => s.Drawing.DrawingNumber).ShouldBe(["17 500 614 A", "18 502 279 A", "17 500 694 A", "17 500 695 A", "18 502 553 A", "17 500 965 A"]);
        near.Similar.Select(s => s.Drawing.Ah).Distinct().Order().ShouldBe(["560", "620", "620(DIN)"]);     // all Ah ratings for that voltage + footprint
        near.Similar[0].FitPercent.ShouldBeGreaterThan(near.Similar[^1].FitPercent);

        var none = await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 3000, 1500, 1500)).Ok<SearchResultDto>();
        none.Mode.ShouldBe("None");
        (await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 99, 350, 780))).StatusCode.ShouldBe((HttpStatusCode)422);     // BRD: 3-4 digit dimensions
        (await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 12345, 350, 780))).StatusCode.ShouldBe((HttpStatusCode)422);
    }

    [Fact]
    public async Task Number_search_enforces_the_configured_format()
    {
        var c = await f.LoginAdminAsync();
        (await c.GetAsync("/api/drawings/by-number?number=17%20500%20614%20A").Ok<DrawingDetailDto>()).Drawing.Model.ShouldBe("ETV 320");
        (await c.GetAsync("/api/drawings/by-number?number=17%20500%20614%20a").Ok<DrawingDetailDto>()).Drawing.DrawingNumber.ShouldBe("17 500 614 A");
        (await c.GetAsync("/api/drawings/by-number?number=17500614A")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await c.GetAsync("/api/drawings/by-number?number=11%20111%20111%20Z")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    // ------------------------------------------------------------------ admin drawing lifecycle
    [Fact]
    public async Task Admin_can_create_update_revise_and_delete_drawings_with_history()
    {
        var c = await f.LoginAdminAsync(); var b = await Boot(c);
        var d = await CreateDrawing(c, "80 100 001 A", Model(b, "EFG 218"), Conn(b, "DIN 160A"));
        d.Drawing.RevisionLabel.ShouldBe("A");
        (await c.PostAsJsonAsync("/api/drawings", new { drawingNumber = "80 100 001 A", modelId = Model(b, "EFG 218"), voltageV = 48, ahValue = 560, lengthMm = 1500, widthMm = 500, heightMm = 800, connectorTypeId = Conn(b, "DIN 160A"), fileId = d.File!.Id })).StatusCode.ShouldBe((HttpStatusCode)422);  // duplicate number
        (await c.PostAsJsonAsync("/api/drawings", new { drawingNumber = "8010001A", modelId = Model(b, "EFG 218"), voltageV = 48, ahValue = 560, lengthMm = 1500, widthMm = 500, heightMm = 800, connectorTypeId = Conn(b, "DIN 160A"), fileId = d.File.Id })).StatusCode.ShouldBe((HttpStatusCode)422); // bad format

        var upd = await c.PutAsJsonAsync($"/api/drawings/{d.Drawing.Id}", new { drawingNumber = "80 100 001 A", modelId = Model(b, "EFG 218"), voltageV = 48, ahValue = 560, lengthMm = 1500, widthMm = 505, heightMm = 800, connectorTypeId = Conn(b, "DIN 160A"), comments = "edited", status = "Active" }).Ok<DrawingDetailDto>();
        upd.Drawing.WidthMm.ShouldBe(505); upd.Drawing.Comments.ShouldBe("edited");

        var up2 = await UploadDrawing(c, "Rev B");
        var rev = await c.PostAsJsonAsync($"/api/drawings/{d.Drawing.Id}/revisions", new { fileId = up2.Id, changeNotes = "Connector hole moved", newDrawingNumber = "80 100 002 A" }).Ok<DrawingDetailDto>();
        rev.Drawing.RevisionLabel.ShouldBe("B"); rev.Drawing.DrawingNumber.ShouldBe("80 100 002 A");
        rev.Revisions.Select(r => r.Label).ShouldBe(["B", "A"]);
        rev.Revisions[1].DrawingNumber.ShouldBe("80 100 001 A");           // history keeps the old number + file
        var old = await c.GetAsync("/api/drawings/by-number?number=80%20100%20001%20A").Ok<DrawingDetailDto>();
        old.Drawing.Id.ShouldBe(d.Drawing.Id); old.MatchedNote.ShouldContain("superseded");

        var file = await c.GetAsync($"/api/files/{rev.File!.Id}?inline=true");
        file.Content.Headers.ContentType!.MediaType.ShouldBe("application/pdf");
        file.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("inline");
        var dl = await c.GetAsync($"/api/files/{rev.File.Id}");
        dl.Content.Headers.ContentDisposition!.DispositionType.ShouldBe("attachment");

        var list = await c.GetAsync("/api/drawings?q=80100&pageSize=10").Ok<PagedResult<DrawingDto>>();
        list.Total.ShouldBe(1);
        (await c.DeleteAsync($"/api/drawings/{d.Drawing.Id}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await c.GetAsync($"/api/drawings/{d.Drawing.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Uploads_are_validated_by_content_extension_and_size()
    {
        var c = await f.LoginAdminAsync();
        (await c.PostAsync("/api/files/drawings", HttpExt.File("evil.pdf", "<html><script>alert(1)</script></html>"u8.ToArray()))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);   // content is not a PDF
        (await c.PostAsync("/api/files/drawings", HttpExt.File("evil.exe", [0x4D, 0x5A, 0x90, 0x00, 0x03]))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);                       // extension not allowed
        (await c.PostAsync("/api/files/drawings", HttpExt.File("empty.pdf", []))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await c.PostAsync("/api/files/drawings", HttpExt.File("../../etc/passwd.pdf", Pdf("traversal")))).StatusCode.ShouldBe(HttpStatusCode.OK);   // path is discarded; stored under a random id
        var up = await c.PostAsync("/api/files/drawings", HttpExt.File("ok.pdf", Pdf("ok"))).Ok<UploadedFileDto>();
        up.Name.ShouldBe("ok.pdf");
        up.Url.ShouldStartWith("/api/files/fil_"); up.AbsoluteUrl.ShouldStartWith("http://portal.test/api/files/fil_"); up.Sha256.Length.ShouldBe(64);
    }

    // ------------------------------------------------------------------ the whole request workflow incl. e-mail
    [Fact]
    public async Task Request_workflow_emails_notifies_closes_on_upload_and_enforces_permissions()
    {
        var admin = await f.LoginAdminAsync(); var b = await Boot(admin);
        var emailA = "priya.r@test.local"; var emailB = "mark.t@test.local";
        await admin.PostAsJsonAsync("/api/users", new { email = emailA, fullName = "Priya R.", role = "User", department = "Marketing" }).Ok<UserDto>();
        await admin.PostAsJsonAsync("/api/users", new { email = emailB, fullName = "Mark T.", role = "User" }).Ok<UserDto>();
        (await admin.PostAsJsonAsync("/api/users", new { email = emailA, fullName = "Dup", role = "User" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var priya = await f.LoginWithEmailOtpAsync(emailA); var mark = await f.LoginWithEmailOtpAsync(emailB);

        // role enforcement
        (await priya.GetAsync("/api/drawings")).StatusCode.Should403();
        (await priya.GetAsync("/api/audit")).StatusCode.Should403();
        (await priya.GetAsync("/api/users")).StatusCode.Should403();
        (await priya.PostAsync("/api/files/drawings", HttpExt.File("x.pdf", Pdf("x")))).StatusCode.Should403();
        (await priya.PostAsJsonAsync("/api/master/named/makes", new { name = "Nope" })).StatusCode.Should403();

        // new drawing request needs the BRD fields + a reference attachment
        var body = new Dictionary<string, object?> { ["type"] = "New", ["priority"] = "High", ["categoryName"] = "Imports", ["vehicleTypeName"] = "Reach Truck", ["makeName"] = "Jungheinrich", ["modelName"] = "ETV 320", ["capacity"] = "1.8 T", ["voltageV"] = 36, ["ahValue"] = 620, ["ahStandard"] = "DIN", ["lengthMm"] = 1530, ["widthMm"] = 655, ["heightMm"] = 890, ["connectorName"] = "SR 350A", ["description"] = "Need a tray for new customer fleet." };
        (await priya.PostAsJsonAsync("/api/requests", body)).StatusCode.ShouldBe((HttpStatusCode)422);   // no attachment
        var att = await priya.PostAsync("/api/files/attachments", HttpExt.File("ref.png", Png)).Ok<UploadedFileDto>();
        (await priya.PostAsync("/api/files/attachments", HttpExt.File("ref.exe", [1, 2, 3]))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        body["attachmentFileIds"] = new[] { att.Id };
        body["lengthMm"] = 12;
        (await priya.PostAsJsonAsync("/api/requests", body)).StatusCode.ShouldBe((HttpStatusCode)422);   // dimension digits
        body["lengthMm"] = 1530;
        var req = await priya.PostAsJsonAsync("/api/requests", body).Ok<RequestDetailDto>();
        req.TicketNo.ShouldMatch(@"^DR-\d{4}-\d{6}$"); req.Status.ShouldBe("Submitted");

        // admin got an e-mail + in-app notification
        await f.Scoped(async sp => { var db = sp.GetRequiredService<AppDbContext>(); (await db.EmailOutbox.CountAsync(e => e.Category == "RequestSubmitted" && e.ToAddress == ApiFixture.AdminEmail && e.Subject.Contains(req.TicketNo))).ShouldBe(1); return 0; });
        var notes = await admin.GetAsync("/api/notifications").Ok<JsonElement>();
        notes.GetProperty("items").EnumerateArray().Any(n => n.GetProperty("title").GetString()!.Contains(req.TicketNo)).ShouldBeTrue();

        // visibility: owner + admins only; attachments follow the same rule
        (await priya.GetAsync($"/api/requests/{req.Id}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await mark.GetAsync($"/api/requests/{req.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await mark.GetAsync(att.Url)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await admin.GetAsync(att.Url)).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await mark.GetAsync("/api/requests").Ok<PagedResult<RequestListItemDto>>()).Total.ShouldBe(0);
        (await admin.GetAsync("/api/requests?q=" + req.TicketNo).Ok<PagedResult<RequestListItemDto>>()).Total.ShouldBe(1);

        // technical discussion: both directions e-mail the other party
        await priya.PostAsJsonAsync($"/api/requests/{req.Id}/comments", new { body = "Can you confirm lead time?" }).Ok<CommentViewDto>();
        await admin.PostAsJsonAsync($"/api/requests/{req.Id}/comments", new { body = "Yes - 3 days. <script>x</script>" }).Ok<CommentViewDto>();
        (await mark.GetAsync($"/api/requests/{req.Id}/comments")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await priya.GetAsync($"/api/requests/{req.Id}/comments").Ok<List<CommentViewDto>>()).Count.ShouldBe(2);

        // status updates -> requestor
        (await admin.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "Rejected" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);   // reason required
        var assigned = await admin.GetAsync("/api/users/admins").Ok<List<UserDto>>();
        (await admin.PostAsJsonAsync($"/api/requests/{req.Id}/assign", new { assigneeId = assigned[0].Id }).Ok<RequestDetailDto>()).Status.ShouldBe("Assigned");
        (await admin.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "InProgress", note = "Drawing started" }).Ok<RequestDetailDto>()).Status.ShouldBe("InProgress");
        (await priya.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "Completed" })).StatusCode.Should403();
        (await admin.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "Completed" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);  // must upload or point to an existing drawing

        // admin uploads the drawing against the request -> ticket closes automatically, requestor is e-mailed
        var d = await CreateDrawing(admin, "80 200 001 A", Model(b, "ETV 320"), Conn(b, "SR 350A"), 36, 620, "DIN", 1530, 655, 890, requestId: req.Id);
        var closed = await priya.GetAsync($"/api/requests/{req.Id}").Ok<RequestDetailDto>();
        closed.Status.ShouldBe("Completed"); closed.IsClosed.ShouldBeTrue(); closed.ResultDrawingNumber.ShouldBe("80 200 001 A");
        closed.Events.Select(e => e.ToStatus).ShouldContain("Completed");
        closed.ResultDrawing!.DrawingNumber.ShouldBe("80 200 001 A"); Assert.NotNull(closed.ResultDrawing.FileId);   // powers the Visual comparison panel
        (await admin.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "InProgress" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // closed is final
        (await priya.GetAsync($"/api/drawings/{d.Drawing.Id}")).StatusCode.ShouldBe(HttpStatusCode.OK);

        // delivery: process the outbox (File transport) and verify .eml files for every notification
        var sent = await f.Scoped(sp => sp.GetRequiredService<EmailOutboxProcessor>().ProcessOnceAsync(100));
        sent.ShouldBeGreaterThan(5);
        var cats = await f.Scoped(async sp => await sp.GetRequiredService<AppDbContext>().EmailOutbox.Where(e => e.Status == EmailStatus.Sent).Select(e => e.Category).Distinct().ToListAsync());
        cats.ShouldBe(["Otp", "Welcome", "RequestSubmitted", "RequestComment", "RequestStatus", "RequestCompleted"], ignoreOrder: true);
        Directory.GetFiles(Path.Combine(f.Root, "mail"), "*.eml").Length.ShouldBeGreaterThan(5);
        var emls = Directory.GetFiles(Path.Combine(f.Root, "mail"), "*.eml").Select(File.ReadAllText).ToList();
        emls.ShouldContain(t => t.Contains("Content-Id: <logo-brute>") && t.Contains("Content-Id: <logo-amara>") && t.Contains("image/png"));   // branded, inline logos
        var html = await f.Scoped(async sp => await sp.GetRequiredService<AppDbContext>().EmailOutbox.Where(e => e.Category == "RequestComment").Select(e => e.HtmlBody).ToListAsync());
        html.ShouldContain(h => h.Contains("&lt;script&gt;"));
        html.ShouldNotContain(h => h.Contains("<script>"));                  // user text is HTML-encoded in e-mails

        // archived drawings are hidden from normal users
        var archived = await admin.PutAsJsonAsync($"/api/drawings/{d.Drawing.Id}", new { drawingNumber = "80 200 001 A", modelId = Model(b, "ETV 320"), voltageV = 36, ahValue = 620, ahStandard = "DIN", lengthMm = 1530, widthMm = 655, heightMm = 890, connectorTypeId = Conn(b, "SR 350A"), status = "Archived" }).Ok<DrawingDetailDto>();
        archived.Drawing.Status.ShouldBe("Archived");
        (await priya.GetAsync($"/api/drawings/{d.Drawing.Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await priya.GetAsync(SearchUrl(Model(b, "ETV 320"), 36, 620, "DIN", 1530, 655, 890)).Ok<SearchResultDto>()).Exact.ShouldBeEmpty();
    }

    [Fact]
    public async Task Modification_requests_reference_a_drawing_and_can_close_with_an_existing_drawing()
    {
        var admin = await f.LoginAdminAsync(); var b = await Boot(admin);
        await admin.PostAsJsonAsync("/api/users", new { email = "sara@test.local", fullName = "Sara K.", role = "User" }).Ok<UserDto>();
        var sara = await f.LoginWithEmailOtpAsync("sara@test.local");
        var target = (await admin.GetAsync("/api/drawings/by-number?number=18%20502%20553%20A").Ok<DrawingDetailDto>()).Drawing;
        var att = await sara.PostAsync("/api/files/attachments", HttpExt.File("markup.pdf", Pdf("markup"))).Ok<UploadedFileDto>();
        (await sara.PostAsJsonAsync("/api/requests", new { type = "Modification", description = "Move holes", reason = "Fit", attachmentFileIds = new[] { att.Id } })).StatusCode.ShouldBe((HttpStatusCode)422);  // drawing required
        var req = await sara.PostAsJsonAsync("/api/requests", new { type = "Modification", relatedDrawingId = target.Id, changeType = "Dimensional", description = "Increase width by 5 mm", reason = "Customer tray change", widthMm = 358, attachmentFileIds = new[] { att.Id } }).Ok<RequestDetailDto>();
        req.TicketNo.ShouldStartWith("DM-"); req.RelatedDrawing!.DrawingNumber.ShouldBe("18 502 553 A");
        var done = await admin.PostAsJsonAsync($"/api/requests/{req.Id}/status", new { status = "Completed", resultDrawingNumber = "18 502 279 A", note = "Existing drawing fits" }).Ok<RequestDetailDto>();
        done.Status.ShouldBe("Completed"); done.ResultDrawingNumber.ShouldBe("18 502 279 A");
        var stats = await sara.GetAsync("/api/requests/stats").Ok<RequestStatsDto>();
        stats.Completed.ShouldBe(1);
    }


    // ------------------------------------------------------------------ OTP robustness (delayed / repeated e-mails)
    private async Task<List<string>> OtpCodesAsync(string email) => await f.Scoped(async sp =>
        (await sp.GetRequiredService<AppDbContext>().EmailOutbox.Where(e => e.ToAddress == email && e.Category == "Otp").OrderBy(e => e.CreatedAtUtc).Select(e => e.TextBody).ToListAsync())
        .Select(b => System.Text.RegularExpressions.Regex.Match(b, @"Code: (\d{6})").Groups[1].Value).ToList());

    [Fact]
    public async Task A_delayed_older_code_still_works_after_requesting_a_new_one_and_codes_are_single_use()
    {
        var admin = await f.LoginAdminAsync(); var email = $"otp{Guid.NewGuid():N}"[..14] + "@test.local";
        await admin.PostAsJsonAsync("/api/users", new { email, fullName = "Otp Tester", role = "User" }).Ok<UserDto>();
        var c = f.NewClient();
        (await c.PostAsJsonAsync("/api/auth/otp/request", new { email })).EnsureSuccessStatusCode();
        await f.Scoped(async sp => { var db = sp.GetRequiredService<AppDbContext>(); foreach (var ch in db.OtpChallenges) ch.CreatedAtUtc = DateTime.UtcNow.AddMinutes(-2); await db.SaveChangesAsync(); return 0; });   // skip the 60 s resend cool-down
        (await c.PostAsJsonAsync("/api/auth/otp/request", new { email })).EnsureSuccessStatusCode();
        var codes = await OtpCodesAsync(email); codes.Count.ShouldBe(2); codes[0].ShouldBe(codes[0]);
        var older = codes[0]; var newer = codes[1];

        (await c.PostAsJsonAsync("/api/auth/otp/verify", new { email, code = older == "000000" ? "000001" : "000000" })).StatusCode.Should401();   // wrong guess does not break the valid codes
        (await c.PostAsJsonAsync("/api/auth/otp/verify", new { email, code = older })).StatusCode.ShouldBe(HttpStatusCode.OK);              // the FIRST (delayed) e-mail is still accepted
        (await f.NewClient().PostAsJsonAsync("/api/auth/otp/verify", new { email, code = newer })).StatusCode.Should401();                     // single use: signing in consumed every live code
    }

    [Fact]
    public async Task Otp_e_mails_retry_within_seconds_and_are_dropped_once_expired_while_other_mail_backs_off_in_minutes()
    {
        var ex = await f.Scoped(async sp =>
        {
            var db = sp.GetRequiredService<AppDbContext>();
            db.EmailOutbox.Add(new EmailOutbox { ToAddress = "a@test.local", Subject = "otp", Category = "Otp", HtmlBody = "x", TextBody = "x" });
            db.EmailOutbox.Add(new EmailOutbox { ToAddress = "b@test.local", Subject = "other", Category = "RequestStatus", HtmlBody = "x", TextBody = "x" });
            db.EmailOutbox.Add(new EmailOutbox { ToAddress = "c@test.local", Subject = "old otp", Category = "Otp", HtmlBody = "x", TextBody = "x", CreatedAtUtc = DateTime.UtcNow.AddMinutes(-10) });
            await db.SaveChangesAsync();
            var proc = new EmailOutboxProcessor(db, new FailingTransport(), Microsoft.Extensions.Options.Options.Create(new DrawingPortal.Api.Options.EmailOptions()), Microsoft.Extensions.Options.Options.Create(new DrawingPortal.Api.Options.AuthOptions()), Microsoft.Extensions.Logging.Abstractions.NullLogger<EmailOutboxProcessor>.Instance);
            await proc.ProcessOnceAsync(100);
            var rows = await db.EmailOutbox.Where(e => e.ToAddress == "a@test.local" || e.ToAddress == "b@test.local" || e.ToAddress == "c@test.local").ToListAsync();
            return rows.ToDictionary(r => r.ToAddress);
        });
        (ex["a@test.local"].NextAttemptAtUtc - DateTime.UtcNow).TotalSeconds.ShouldBeLessThan(10);       // code: retry in ~3 s
        (ex["b@test.local"].NextAttemptAtUtc - DateTime.UtcNow).TotalSeconds.ShouldBeGreaterThan(60);    // other mail: minutes
        ex["c@test.local"].Status.ShouldBe(EmailStatus.Failed);                                           // expired code is not sent late
    }
    private sealed class FailingTransport : IEmailTransport { public Task SendAsync(EmailOutbox mail, CancellationToken ct) => throw new InvalidOperationException("smtp down"); }

    // ------------------------------------------------------------------ bulk Excel
    private static byte[] Workbook(IEnumerable<Dictionary<string, object?>> rows) { using var ms = new MemoryStream(); MiniExcel.SaveAs(ms, rows); return ms.ToArray(); }
    private static Dictionary<string, object?> Row(string no, string make, string model, string url, object? len = null, string cap = "1.8 T") => new()
    {
        ["DrawingNumber"] = no, ["Category"] = "Imports", ["Make"] = make, ["VehicleType"] = "Forklift", ["Model"] = model, ["Capacity"] = cap, ["Voltage"] = 48, ["AhRating"] = "750",
        ["Connector"] = "DIN 160A", ["Length"] = len ?? 830, ["Width"] = 735, ["Height"] = 630, ["Comments"] = "bulk", ["CompetitorDrawingNumber"] = "", ["DrawingUrl"] = url
    };
    private async Task<BulkJobDto> RunBulk(HttpClient admin, byte[] xlsx, bool skip, bool auto)
    {
        var form = HttpExt.File("import.xlsx", xlsx);
        form.Add(new StringContent(skip.ToString().ToLower()), "skipDuplicates"); form.Add(new StringContent(auto.ToString().ToLower()), "autoCreateMaster");
        var job = await admin.PostAsync("/api/bulk-import", form).Ok<BulkJobDto>();
        job.Status.ShouldBe("Queued");
        await f.Scoped(async sp => { await sp.GetRequiredService<IBulkImportService>().ProcessAsync(job.Id, default); return 0; });
        return await admin.GetAsync($"/api/bulk-import/{job.Id}").Ok<BulkJobDto>();
    }

    [Fact]
    public async Task Bulk_import_streams_rows_in_batches_skips_duplicates_and_reports_row_errors()
    {
        var admin = await f.LoginAdminAsync();
        var u1 = await UploadDrawing(admin, "bulk one"); var u2 = await UploadDrawing(admin, "bulk two"); var u3 = await UploadDrawing(admin, "bulk three");
        var rows = new List<Dictionary<string, object?>>
        {
            Row("90 100 001 A", "Linde", "EFG 218", u1.AbsoluteUrl),                // ok
            Row("90 100 002 A", "Linde", "EFG 218", u2.AbsoluteUrl),                // ok
            Row("17 500 614 A", "Linde", "EFG 218", u3.AbsoluteUrl),                // already exists -> skipped
            Row("9010003A", "Linde", "EFG 218", u3.AbsoluteUrl),                    // bad number format
            Row("90 100 004 A", "Nope Motors", "X1", u3.AbsoluteUrl),               // unknown make
            Row("90 100 005 A", "Linde", "EFG 218", u3.AbsoluteUrl, len: 12),       // 2-digit dimension
            Row("90 100 006 A", "Linde", "EFG 218", ""),                            // missing URL
            Row("90 100 007 A", "Linde", "EFG 218", "https://evil.example/x.pdf"),  // not one of ours
            Row("90 100 001 A", "Linde", "EFG 218", u1.AbsoluteUrl),                // duplicate inside file -> skipped
        };
        var job = await RunBulk(admin, Workbook(rows), skip: true, auto: false);
        job.Status.ShouldBe("CompletedWithErrors");
        (job.TotalRows, job.CreatedCount, job.SkippedCount, job.ErrorCount).ShouldBe((9, 2, 2, 5));
        var errs = await admin.GetAsync($"/api/bulk-import/{job.Id}/errors").Ok<List<BulkErrorDto>>();
        errs.Select(e => e.RowNumber).ShouldBe([5, 6, 7, 8, 9]);
        errs[0].Message.ShouldContain("format"); errs[1].Message.ShouldContain("Nope Motors"); errs[2].Message.ShouldContain("3 or 4 digits");
        var csv = await admin.GetAsync($"/api/bulk-import/{job.Id}/errors.csv");
        (await csv.Content.ReadAsStringAsync()).ShouldContain("Row,DrawingNumber,Error");
        (await admin.GetAsync("/api/drawings/by-number?number=90%20100%20002%20A")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await admin.GetAsync("/api/drawings/by-number?number=90%20100%20004%20A")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // with "create missing master data" the unknown make/model are created and drawings land
        var u4 = await UploadDrawing(admin, "bulk four");
        var job2 = await RunBulk(admin, Workbook([Row("90 100 010 A", "Zebra Lifts", "Z-100", u4.AbsoluteUrl, cap: "2 T")]), skip: true, auto: true);
        job2.Status.ShouldBe("Completed"); job2.CreatedCount.ShouldBe(1);
        (await Boot(admin)).Makes.ShouldContain(m => m.Name == "Zebra Lifts");

        (await admin.PostAsync("/api/bulk-import", HttpExt.File("notes.xlsx", "not a zip"u8.ToArray()))).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await admin.GetAsync("/api/bulk-import/template")).Content.Headers.ContentType!.MediaType.ShouldContain("spreadsheetml");
    }

    [Fact]
    public async Task Bulk_import_and_drawing_forms_refuse_to_attach_the_same_drawing_file_twice()
    {
        var admin = await f.LoginAdminAsync(); var b = await Boot(admin);
        var a = await UploadDrawing(admin, "reuse file a"); var a2 = await UploadDrawing(admin, "reuse file a");   // identical content, uploaded twice
        var c = await UploadDrawing(admin, "reuse file c"); var d = await UploadDrawing(admin, "reuse file d");
        var job = await RunBulk(admin, Workbook([
            Row("91 100 001 A", "Linde", "EFG 218", a.AbsoluteUrl),    // ok
            Row("91 100 002 A", "Linde", "EFG 218", a.AbsoluteUrl),    // same URL as row above
            Row("91 100 003 A", "Linde", "EFG 218", a2.AbsoluteUrl),   // different upload, identical content
            Row("91 100 004 A", "Linde", "EFG 218", c.AbsoluteUrl),    // ok
        ]), skip: false, auto: false);
        (job.CreatedCount, job.ErrorCount).ShouldBe((2, 2));
        var errs = await admin.GetAsync($"/api/bulk-import/{job.Id}/errors").Ok<List<BulkErrorDto>>();
        errs.Select(e => e.RowNumber).ShouldBe([3, 4]); errs.All(e => e.Message.Contains("91 100 001 A")).ShouldBeTrue();
        // a second import that reuses the file of an existing drawing is refused as well
        var job2 = await RunBulk(admin, Workbook([Row("91 100 005 A", "Linde", "EFG 218", c.AbsoluteUrl)]), skip: false, auto: false);
        (job2.CreatedCount, job2.ErrorCount).ShouldBe((0, 1));

        // single create / correction of the file on an existing drawing
        var created = await CreateDrawing(admin, "91 100 010 A", Model(b, "EFG 218"), Conn(b, "DIN 160A"), l: 1111, w: 555, h: 777);
        var reuse = await admin.PostAsJsonAsync("/api/drawings", new { drawingNumber = "91 100 011 A", modelId = Model(b, "EFG 218"), voltageV = 48, ahValue = 560, ahStandard = "", lengthMm = 1112, widthMm = 555, heightMm = 777, connectorTypeId = Conn(b, "DIN 160A"), fileId = c.Id });
        reuse.StatusCode.ShouldBe((HttpStatusCode)422);
        var fixedUp = await admin.PutAsJsonAsync($"/api/drawings/{created.Drawing.Id}", new { drawingNumber = "91 100 010 A", modelId = Model(b, "EFG 218"), voltageV = 48, ahValue = 560, ahStandard = "", lengthMm = 1111, widthMm = 555, heightMm = 777, connectorName = "Brand New Plug 99", status = "Active", fileId = d.Id }).Ok<DrawingDetailDto>();
        fixedUp.Drawing.Connector.ShouldBe("Brand New Plug 99");
        fixedUp.File!.Id.ShouldBe(d.Id); fixedUp.Revisions.Count.ShouldBe(1);   // corrected in place, no new revision
        (await Boot(admin)).Connectors.ShouldContain(x => x.Name == "Brand New Plug 99");
    }

    // ------------------------------------------------------------------ master data, settings, audit
    [Fact]
    public async Task Master_data_is_protected_and_settings_drive_validation_and_search()
    {
        var c = await f.LoginAdminAsync(); var b = await Boot(c);
        var linde = b.Makes.First(m => m.Name == "Linde");
        (await c.DeleteAsync($"/api/master/named/makes/{linde.Id}")).StatusCode.ShouldBe(HttpStatusCode.Conflict);     // used by models
        var cat = await c.PostAsJsonAsync("/api/master/named/categories", new { name = "Temp Category" }).Ok<NamedItemDto>();
        (await c.PostAsJsonAsync("/api/master/named/categories", new { name = "temp category" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await c.DeleteAsync($"/api/master/named/categories/{cat.Id}")).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await c.GetAsync("/api/master/named/bogus")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        // narrower tolerances change the suggestions
        var etv = Model(b, "ETV 320");
        (await c.PutAsJsonAsync("/api/settings", new { numberMask = "## ### ### A", toleranceLengthMm = 5, toleranceWidthMm = 5, toleranceHeightMm = 5 })).EnsureSuccessStatusCode();
        try
        {
            var r = await c.GetAsync(SearchUrl(etv, 48, 620, "DIN", 1220, 350, 780)).Ok<SearchResultDto>();
            r.Tolerance.ShouldBe(new ToleranceDto(5, 5, 5));
            r.Similar.Select(s => s.Drawing.DrawingNumber).ShouldBe(["17 500 614 A", "18 502 279 A", "17 500 694 A", "17 500 695 A"]);
            (await c.PutAsJsonAsync("/api/settings", new { numberMask = "(a+)+$", toleranceLengthMm = 5, toleranceWidthMm = 5, toleranceHeightMm = 5 })).StatusCode.ShouldBe((HttpStatusCode)422);
            (await c.PutAsJsonAsync("/api/settings", new { numberMask = "## ### ### A", toleranceLengthMm = -1, toleranceWidthMm = 5, toleranceHeightMm = 5 })).StatusCode.ShouldBe((HttpStatusCode)422);
            // admin-configurable number format applies to the next drawing created
            (await c.PutAsJsonAsync("/api/settings", new { numberMask = "AA-####", toleranceLengthMm = 20, toleranceWidthMm = 10, toleranceHeightMm = 20 })).EnsureSuccessStatusCode();
            (await Boot(c)).DrawingNumberMask.ShouldBe("AA-####");
            var up = await UploadDrawing(c, "fmt");
            var create = (string no) => c.PostAsJsonAsync("/api/drawings", new { drawingNumber = no, modelId = etv, voltageV = 48, ahValue = 100, lengthMm = 900, widthMm = 400, heightMm = 500, connectorTypeId = Conn(b, "SR 350A"), fileId = up.Id });
            (await create("25 600 001 A")).StatusCode.ShouldBe((HttpStatusCode)422);
            (await create("ab-1234")).StatusCode.ShouldBe(HttpStatusCode.OK);
        }
        finally { (await c.PutAsJsonAsync("/api/settings", new { numberMask = "## ### ### A", toleranceLengthMm = 20, toleranceWidthMm = 10, toleranceHeightMm = 20 })).EnsureSuccessStatusCode(); }

        var audit = await c.GetAsync("/api/audit?pageSize=200").Ok<PagedResult<AuditDto>>();
        audit.Items.Select(a => a.Action).ShouldContain("SettingsChanged");
        audit.Items.Select(a => a.Action).ShouldContain("Login");
    }

    [Fact]
    public async Task Drawing_list_text_filter_matches_number_with_or_without_spaces()
    {
        var c = await f.LoginAdminAsync();
        (await c.GetAsync("/api/drawings?q=17500614").Ok<PagedResult<DrawingDto>>()).Items.Select(d => d.DrawingNumber).ShouldBe(["17 500 614 A"]);
        (await c.GetAsync("/api/drawings?q=17%20500%20614").Ok<PagedResult<DrawingDto>>()).Items.Select(d => d.DrawingNumber).ShouldBe(["17 500 614 A"]);
        (await c.GetAsync("/api/drawings?q=ETV").Ok<PagedResult<DrawingDto>>()).Total.ShouldBeGreaterThanOrEqualTo(6);
        (await c.GetAsync("/api/drawings?q=zzzz-not-there").Ok<PagedResult<DrawingDto>>()).Total.ShouldBe(0);
    }

    [Fact]
    public async Task Dashboard_and_pagination_work_for_admins()
    {
        var c = await f.LoginAdminAsync();
        var d = await c.GetAsync("/api/dashboard").Ok<DashboardDto>();
        d.TotalDrawings.ShouldBeGreaterThanOrEqualTo(11);
        var page = await c.GetAsync("/api/drawings?page=2&pageSize=5&sort=number&dir=asc").Ok<PagedResult<DrawingDto>>();
        (page.Page, page.PageSize, page.Items.Count).ShouldBe((2, 5, 5));
        (await c.GetAsync("/api/drawings?pageSize=100000").Ok<PagedResult<DrawingDto>>()).PageSize.ShouldBe(100);   // clamped
        var docs = await c.GetAsync("/api/documents").Ok<PagedResult<DocumentDto>>();
        docs.Total.ShouldBeGreaterThanOrEqualTo(1);
    }
}

internal static class Assertions
{
    public static void ShouldBe<T>(this T actual, T expected) => Assert.Equal(expected, actual);
    public static void ShouldBe<T>(this IEnumerable<T> actual, IEnumerable<T> expected, bool ignoreOrder = false)
    { if (ignoreOrder) Assert.Equal(expected.OrderBy(x => x), actual.OrderBy(x => x)); else Assert.Equal(expected, actual); }
    public static void ShouldContain(this string s, string part) => Assert.Contains(part, s);
    public static void ShouldContain<T>(this IEnumerable<T> s, T item) => Assert.Contains(item, s);
    public static void ShouldNotContain(this string s, string part) => Assert.DoesNotContain(part, s);
    public static void ShouldContain<T>(this IEnumerable<T> s, Func<T, bool> pred) => Assert.Contains(s, new Predicate<T>(pred));
    public static void ShouldNotContain<T>(this IEnumerable<T> s, Func<T, bool> pred) => Assert.DoesNotContain(s, new Predicate<T>(pred));
    public static void ShouldBeEmpty<T>(this IEnumerable<T> s) => Assert.Empty(s);
    public static void ShouldStartWith(this string s, string p) => Assert.StartsWith(p, s);
    public static void ShouldMatch(this string s, string pattern) => Assert.Matches(pattern, s);
    public static void ShouldBeTrue(this bool b) => Assert.True(b);
    public static void ShouldBeLessThan<T>(this T a, T b) where T : IComparable<T> => Assert.True(a.CompareTo(b) < 0, $"{a} should be < {b}");
    public static void ShouldBeGreaterThan<T>(this T a, T b) where T : IComparable<T> => Assert.True(a.CompareTo(b) > 0, $"{a} should be > {b}");
    public static void ShouldBeGreaterThanOrEqualTo<T>(this T a, T b) where T : IComparable<T> => Assert.True(a.CompareTo(b) >= 0, $"{a} should be >= {b}");
    public static void Should401(this HttpStatusCode c) => Assert.Equal(HttpStatusCode.Unauthorized, c);
    public static void Should403(this HttpStatusCode c) => Assert.Equal(HttpStatusCode.Forbidden, c);
    public static T Result<T>(this Task<T> t) => t.GetAwaiter().GetResult();
}