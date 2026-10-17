export const fmtDate = (s?: string | null) =>
  s
    ? new Date(s).toLocaleDateString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
export const fmtDateTime = (s?: string | null) =>
  s
    ? new Date(s).toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
export function ago(s: string): string {
  const m = Math.max(
    0,
    Math.round((Date.now() - new Date(s).getTime()) / 60000),
  );
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}
export const fmtSize = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1048576
      ? `${(b / 1024).toFixed(0)} KB`
      : `${(b / 1048576).toFixed(1)} MB`;
export const initials = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
export const fileUrl = (id: string, inline = false) =>
  `/api/files/${id}${inline ? "?inline=true" : ""}`;
export const statusLabel = (s: string) =>
  s === "InReview" ? "In review" : s === "InProgress" ? "In progress" : s;

/** Mirrors the server's drawing-number MASK: # digit, A letter, X letter-or-digit, everything else literal. */
export function formatByMask(
  input: string,
  mask: string,
  deleting = false,
): string {
  const raw = input
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase()
    .split("");
  let out = "";
  let i = 0;
  for (const m of mask) {
    if (i >= raw.length) break;
    if (m === "#" || m === "A" || m === "X") {
      let c = raw[i];
      while (
        c !== undefined &&
        !(m === "#"
          ? /\d/.test(c)
          : m === "A"
            ? /[A-Z]/.test(c)
            : /[A-Z0-9]/.test(c))
      ) {
        i++;
        c = raw[i];
      }
      if (c === undefined) break;
      out += c;
      i++;
    } else out += m;
  }
  if (deleting)
    while (out.length && !/[A-Za-z0-9]/.test(out[out.length - 1]))
      out = out.slice(0, -1);
  return out;
}
export const maskRegex = (mask: string) =>
  new RegExp(
    "^" +
      [...mask]
        .map((m) =>
          m === "#"
            ? "[0-9]"
            : m === "A"
              ? "[A-Z]"
              : m === "X"
                ? "[A-Z0-9]"
                : m.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&"),
        )
        .join("") +
      "$",
  );
export const isValidNumber = (v: string, mask: string) =>
  maskRegex(mask).test(v.trim().replace(/\s+/g, " ").toUpperCase());
export const maskHint = (mask: string) => mask.replace(/#/g, "9");
export const dimOk = (v: string) => /^\d{3,4}$/.test(v);
export const digits = (v: string, max = 4) =>
  v.replace(/\D/g, "").slice(0, max);
