using System.Net;
using System.Reflection;
using System.Text;

namespace DrawingPortal.Api.Services;

/// <summary>Logos embedded in the assembly; attached to every e-mail as inline (CID) images so they show in Outlook/Gmail without "load images".</summary>
public static class EmailAssets
{
    private static readonly Dictionary<string, byte[]> Cache = new();
    public static byte[]? Get(string name)
    {
        lock (Cache)
        {
            if (Cache.TryGetValue(name, out var hit)) return hit;
            using var s = typeof(EmailAssets).Assembly.GetManifestResourceStream($"email.{name}.png");
            if (s is null) return null;
            using var ms = new MemoryStream(); s.CopyTo(ms);
            return Cache[name] = ms.ToArray();
        }
    }
    public static readonly string[] Cids = ["logo-brute", "logo-amara"];
}

/// <summary>
/// Branded, table-based HTML e-mails (renders in Outlook, Gmail, Apple Mail, mobile).
/// EVERY dynamic value is HTML-encoded - user-supplied text can never inject markup.
/// </summary>
public static class EmailTemplates
{
    private const string Orange = "#E06A2C", Ink = "#171A1E", Muted = "#6E737C", Line = "#E9E6DF", Panel = "#FBFAF8";
    private static string E(string? s) => WebUtility.HtmlEncode(s ?? "");

    private static string Frame(string preheader, string body) => $$"""
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Amaron Brute Drawing Portal</title></head>
<body style="margin:0;padding:0;background:#F3F1EC;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F3F1EC;">{{E(preheader)}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid {{Line}};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td style="height:5px;line-height:5px;font-size:0;background:{{Orange}};background-image:linear-gradient(90deg,#87BF5E,{{Orange}});">&nbsp;</td></tr>
    <tr><td style="padding:22px 30px 18px;background:{{Panel}};border-bottom:1px solid {{Line}};">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td align="left" valign="middle"><img src="cid:logo-brute" alt="Amaron Brute" width="150" style="display:block;border:0;outline:none;height:auto;max-width:150px;"></td>
        <td align="right" valign="middle"><img src="cid:logo-amara" alt="Amara Raja" width="58" style="display:block;border:0;outline:none;height:auto;max-width:58px;"></td>
      </tr></table>
      <div style="margin-top:14px;font-size:11px;letter-spacing:1.6px;font-weight:700;color:{{Muted}};text-transform:uppercase;">Amaron Brute Drawing Portal &nbsp;&middot;&nbsp; Motive Power</div>
    </td></tr>
    <tr><td style="padding:30px 30px 8px;">{{body}}</td></tr>
    <tr><td style="padding:22px 30px 26px;background:{{Panel}};border-top:1px solid {{Line}};">
      <div style="font-size:12px;line-height:1.6;color:{{Muted}};">This is an automated message from the <b style="color:{{Ink}};">Amaron Brute Drawing Portal</b>. Please do not reply to this e-mail.</div>
      <div style="margin-top:10px;font-size:11px;color:#A9A398;">&copy; Amara Raja Energy &amp; Mobility Limited &nbsp;&middot;&nbsp; <i>Gotta be a better way</i></div>
    </td></tr>
  </table>
</td></tr></table>
</body></html>
""";

    private static string Heading(string heading, string intro) =>
        $"<h1 style=\"margin:0 0 10px;font-size:23px;line-height:1.3;color:{Ink};font-weight:700;\">{E(heading)}</h1>" +
        $"<p style=\"margin:0 0 22px;font-size:14.5px;line-height:1.65;color:#41464E;\">{E(intro)}</p>";

    private static string Button(string text, string url) =>
        $"<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:26px 0 24px;\"><tr><td style=\"background:{Orange};border-radius:11px;\">" +
        $"<a href=\"{E(url)}\" style=\"display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#FFFFFF;text-decoration:none;font-family:'Segoe UI',Helvetica,Arial,sans-serif;\">{E(text)} &rarr;</a></td></tr></table>" +
        $"<div style=\"font-size:12px;color:{Muted};margin:-8px 0 22px;word-break:break-all;\">Button not working? Copy this link: <a href=\"{E(url)}\" style=\"color:{Orange};\">{E(url)}</a></div>";

    private static string Rows(IEnumerable<(string Label, string Value)> rows, StringBuilder text)
    {
        var sb = new StringBuilder($"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"border:1px solid {Line};border-radius:12px;border-collapse:separate;overflow:hidden;\">");
        var first = true;
        foreach (var (l, v) in rows)
        {
            if (string.IsNullOrWhiteSpace(v)) continue;
            sb.Append($"<tr><td width=\"36%\" valign=\"top\" style=\"padding:11px 14px;font-size:12.5px;color:{Muted};background:{Panel};{(first ? "" : $"border-top:1px solid {Line};")}\">{E(l)}</td>" +
                      $"<td valign=\"top\" style=\"padding:11px 14px;font-size:13.5px;font-weight:600;color:{Ink};{(first ? "" : $"border-top:1px solid {Line};")}\">{E(v)}</td></tr>");
            text.AppendLine($"{l}: {v}"); first = false;
        }
        return first ? "" : sb.Append("</table>").ToString();
    }

    public static (string Html, string Text) Build(string heading, string intro, IEnumerable<(string Label, string Value)>? rows = null,
        string? buttonText = null, string? buttonUrl = null, string? note = null)
    {
        var text = new StringBuilder();
        text.AppendLine(heading).AppendLine().AppendLine(intro).AppendLine();
        var body = new StringBuilder(Heading(heading, intro));
        if (rows is not null) body.Append(Rows(rows, text));
        if (!string.IsNullOrWhiteSpace(note))
        {
            body.Append($"<div style=\"margin-top:18px;padding:14px 16px;background:{Panel};border-left:4px solid {Orange};border-radius:0 10px 10px 0;font-size:13.5px;line-height:1.6;color:#2B2F36;white-space:pre-wrap;\">{E(note)}</div>");
            text.AppendLine().AppendLine(note);
        }
        if (buttonText is not null && buttonUrl is not null)
        {
            body.Append(Button(buttonText, buttonUrl));
            text.AppendLine().AppendLine($"{buttonText}: {buttonUrl}");
        }
        return (Frame(heading, body.ToString()), text.ToString());
    }

    public static (string Html, string Text) Otp(string code, int minutes)
    {
        const string heading = "Your sign-in code";
        var intro = $"Use this one-time code to sign in to the Amaron Brute Drawing Portal. It expires in {minutes} minutes and can be used only once.";
        var spaced = string.Join("&nbsp;", code.Select(c => E(c.ToString())));
        var body = Heading(heading, intro) +
            $"<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\"><tr><td align=\"center\" style=\"padding:22px 12px;background:#FFF6EF;border:2px dashed {Orange};border-radius:14px;\">" +
            $"<div style=\"font-size:11px;letter-spacing:1.6px;font-weight:700;color:{Muted};text-transform:uppercase;margin-bottom:8px;\">Your one-time code</div>" +
            $"<div style=\"font-family:'Courier New',Consolas,monospace;font-size:38px;font-weight:700;letter-spacing:8px;color:{Ink};\">{spaced}</div></td></tr></table>" +
            $"<div style=\"margin:22px 0 14px;padding:14px 16px;background:{Panel};border-radius:10px;font-size:13px;line-height:1.6;color:#41464E;\"><b style=\"color:{Ink};\">Didn't request this?</b> You can safely ignore this e-mail — nobody can sign in without the code. Never share it with anyone, including colleagues or support.</div>";
        var text = $"{heading}\n\n{intro}\n\nCode: {code}\n\nIf you did not request this code, you can ignore this e-mail. Never share it with anyone.\n";
        return (Frame($"Your code is {code}", body), text);
    }
}
