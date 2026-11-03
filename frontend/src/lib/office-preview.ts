/**
 * Dependency-free previews for Office files, so Excel / PowerPoint documents can be viewed inside the portal.
 * .xlsx and .pptx are ZIP packages of XML; the browser's DecompressionStream inflates the entries.
 * This is a read-only "quick look" (values, text and pictures) - not a pixel-exact render. Download for the original.
 */

const MAX_ENTRY = 40 * 1024 * 1024; // refuse anything that inflates beyond 40 MB (zip-bomb guard)

type Entry = { method: number; comp: number; size: number; offset: number };

export class Zip {
  private entries = new Map<string, Entry>();
  private buf: ArrayBuffer;
  constructor(buf: ArrayBuffer) {
    this.buf = buf;
    const v = new DataView(buf);
    let eocd = -1;
    for (
      let i = buf.byteLength - 22;
      i >= Math.max(0, buf.byteLength - 65557);
      i--
    )
      if (v.getUint32(i, true) === 0x06054b50) {
        eocd = i;
        break;
      }
    if (eocd < 0) throw new Error("This file is not a valid Office document.");
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const dec = new TextDecoder();
    for (let n = 0; n < count && p + 46 <= buf.byteLength; n++) {
      if (v.getUint32(p, true) !== 0x02014b50) break;
      const nameLen = v.getUint16(p + 28, true);
      const extraLen = v.getUint16(p + 30, true);
      const commentLen = v.getUint16(p + 32, true);
      const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
      this.entries.set(name, {
        method: v.getUint16(p + 10, true),
        comp: v.getUint32(p + 20, true),
        size: v.getUint32(p + 24, true),
        offset: v.getUint32(p + 42, true),
      });
      p += 46 + nameLen + extraLen + commentLen;
    }
  }
  has(name: string) {
    return this.entries.has(name);
  }
  names() {
    return [...this.entries.keys()];
  }
  async bytes(name: string): Promise<Uint8Array> {
    const e = this.entries.get(name);
    if (!e) throw new Error(`Missing ${name}`);
    if (e.size > MAX_ENTRY)
      throw new Error("This file is too large to preview.");
    const v = new DataView(this.buf);
    const start =
      e.offset +
      30 +
      v.getUint16(e.offset + 26, true) +
      v.getUint16(e.offset + 28, true);
    const raw = new Uint8Array(this.buf, start, e.comp);
    if (e.method === 0) return raw;
    if (e.method !== 8)
      throw new Error("Unsupported compression in this file.");
    const stream = new Blob([raw])
      .stream()
      .pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async text(name: string) {
    return new TextDecoder().decode(await this.bytes(name));
  }
}

const xml = (s: string) =>
  new DOMParser().parseFromString(s, "application/xml");
const all = (d: Document | Element, tag: string) =>
  Array.from(d.getElementsByTagName(tag));
const rels = async (z: Zip, path: string) => {
  const m = new Map<string, string>();
  if (!z.has(path)) return m;
  for (const r of all(xml(await z.text(path)), "Relationship"))
    m.set(r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? "");
  return m;
};
/** Resolves a relationship target ("../media/a.png", "worksheets/sheet1.xml", "/xl/x.xml") against its source folder. */
const resolve = (base: string, target: string) => {
  const parts = (
    target.startsWith("/") ? target.slice(1) : base + target
  ).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
};

// ---------------------------------------------------------------- Excel
export interface SheetPreview {
  name: string;
  rows: string[][];
  truncated: boolean;
}
const colIndex = (ref: string) => {
  let n = 0;
  for (const ch of ref.replace(/[^A-Z]/gi, "").toUpperCase())
    n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1;
};
const MAX_ROWS = 300;
const MAX_COLS = 40;

export async function previewXlsx(buf: ArrayBuffer): Promise<SheetPreview[]> {
  const z = new Zip(buf);
  const wb = xml(await z.text("xl/workbook.xml"));
  const wbRels = await rels(z, "xl/_rels/workbook.xml.rels");
  const shared: string[] = [];
  if (z.has("xl/sharedStrings.xml"))
    for (const si of all(xml(await z.text("xl/sharedStrings.xml")), "si"))
      shared.push(
        all(si, "t")
          .map((t) => t.textContent ?? "")
          .join(""),
      );
  const out: SheetPreview[] = [];
  for (const s of all(wb, "sheet")) {
    const target = wbRels.get(s.getAttribute("r:id") ?? "");
    if (!target) continue;
    const path = resolve("xl/", target);
    if (!z.has(path)) continue;
    const rows: string[][] = [];
    let truncated = false;
    for (const r of all(xml(await z.text(path)), "row")) {
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
      const line: string[] = [];
      for (const c of all(r, "c")) {
        const i = colIndex(c.getAttribute("r") ?? "");
        if (i < 0 || i >= MAX_COLS) continue;
        const t = c.getAttribute("t");
        const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
        const val =
          t === "s"
            ? (shared[Number(v)] ?? "")
            : t === "inlineStr"
              ? all(c, "t")
                  .map((x) => x.textContent ?? "")
                  .join("")
              : t === "b"
                ? v === "1"
                  ? "TRUE"
                  : "FALSE"
                : v;
        while (line.length < i) line.push("");
        line[i] = val;
      }
      rows.push(line);
    }
    out.push({ name: s.getAttribute("name") ?? "Sheet", rows, truncated });
  }
  if (out.length === 0) throw new Error("No sheets found in this workbook.");
  return out;
}

// ---------------------------------------------------------------- PowerPoint
export interface SlidePreview {
  n: number;
  paragraphs: string[];
  images: string[]; // blob: URLs
}
const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function previewPptx(buf: ArrayBuffer): Promise<SlidePreview[]> {
  const z = new Zip(buf);
  const pres = xml(await z.text("ppt/presentation.xml"));
  const presRels = await rels(z, "ppt/_rels/presentation.xml.rels");
  const slides: SlidePreview[] = [];
  let n = 0;
  for (const id of all(pres, "p:sldId")) {
    const target = presRels.get(id.getAttribute("r:id") ?? "");
    if (!target) continue;
    const path = resolve("ppt/", target);
    if (!z.has(path)) continue;
    n++;
    const doc = xml(await z.text(path));
    const paragraphs = all(doc, "a:p")
      .map((p) =>
        all(p, "a:t")
          .map((t) => t.textContent ?? "")
          .join(""),
      )
      .map((t) => t.trim())
      .filter(Boolean);
    const dir = path.slice(0, path.lastIndexOf("/") + 1);
    const r = await rels(
      z,
      `${dir}_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`,
    );
    const images: string[] = [];
    for (const b of all(doc, "a:blip")) {
      const t = r.get(b.getAttribute("r:embed") ?? "");
      if (!t) continue;
      const media = resolve(dir, t);
      const mime = MIME[media.split(".").pop()?.toLowerCase() ?? ""];
      if (!mime || !z.has(media)) continue;
      const bytes = await z.bytes(media);
      images.push(
        URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime })),
      );
    }
    slides.push({ n, paragraphs, images });
  }
  if (slides.length === 0)
    throw new Error("No slides found in this presentation.");
  return slides;
}