import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { upload } from "@/lib/api";
import type { BulkFileUpload } from "@/lib/types";
import { fmtSize } from "@/lib/util";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/components/app/common";

type Item = {
  key: number;
  file: File;
  status: "queued" | "uploading" | "ok" | "error";
  message?: string;
  info?: BulkFileUpload;
};

const ACCEPT = ".pdf,.dwg,.dxf,.png,.jpg,.jpeg";
const PARALLEL = 3;
const SHOW = 250;
let nextKey = 1;

/**
 * Step 1 of the bulk import: pick or drop many drawing files at once. Each file name must start with the drawing number,
 * for example "25 600 002 B(48V-775 AH).pdf". Files go to the server a few at a time; every file shows its own result.
 */
export function BulkFilesUploader({
  onBatchDone,
}: {
  onBatchDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [over, setOver] = useState(false);
  const running = useRef(false);
  const queue = useRef<Item[]>([]);

  const patch = useCallback((key: number, p: Partial<Item>) => {
    setItems((all) => all.map((i) => (i.key === key ? { ...i, ...p } : i)));
  }, []);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    const worker = async () => {
      for (let it = queue.current.shift(); it; it = queue.current.shift()) {
        patch(it.key, { status: "uploading" });
        try {
          const info = await upload<BulkFileUpload>(
            "/api/bulk-import/files",
            it.file,
          );
          patch(it.key, { status: "ok", info });
        } catch (e) {
          patch(it.key, { status: "error", message: errMsg(e) });
        }
      }
    };
    await Promise.all(Array.from({ length: PARALLEL }, worker));
    running.current = false;
    onBatchDone();
  }, [patch, onBatchDone]);

  const add = useCallback(
    (files: FileList | File[]) => {
      const fresh: Item[] = Array.from(files).map((file) => ({
        key: nextKey++,
        file,
        status: "queued",
      }));
      if (fresh.length === 0) return;
      setItems((all) => [...all, ...fresh]);
      queue.current.push(...fresh);
      void pump();
    },
    [pump],
  );

  const retry = () => {
    const failed = items.filter((i) => i.status === "error");
    setItems((all) =>
      all.map((i) =>
        i.status === "error"
          ? { ...i, status: "queued", message: undefined }
          : i,
      ),
    );
    queue.current.push(...failed);
    void pump();
  };

  const ok = items.filter((i) => i.status === "ok").length;
  const bad = items.filter((i) => i.status === "error").length;
  const busy = items.length - ok - bad;
  // problems first, then what is still going, then the successes
  const rank = { error: 0, uploading: 1, queued: 2, ok: 3 } as const;
  const shown = [...items]
    .sort((a, b) => rank[a.status] - rank[b.status] || a.key - b.key)
    .slice(0, SHOW);

  return (
    <div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={ACCEPT}
        data-testid="bulk-files-input"
        onChange={(e) => {
          if (e.target.files) add(e.target.files);
          e.target.value = "";
        }}
      />
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-[1.5px] border-dashed p-6 text-center text-[13px] text-muted-foreground transition-colors ${over ? "border-brand bg-brand-soft/40" : "bg-panel"}`}
      >
        <Upload className="mx-auto mb-2 size-7 text-brand" />
        <button
          type="button"
          className="font-bold text-brand-dark hover:underline"
          onClick={() => input.current?.click()}
        >
          Choose drawing files
        </button>{" "}
        or drop them here
        <div className="mt-1.5 text-xs">
          Select as many as you like · PDF, DWG, DXF, PNG or JPG · up to 50 MB
          each
        </div>
        <div className="mt-3 inline-block rounded-lg border bg-card px-3 py-1.5 font-mono text-xs text-foreground">
          25 600 002 B(48V-775 AH).pdf
        </div>
        <div className="mt-1 text-xs">
          drawing number + (voltage – Ah rating). The Excel in step 2 is matched
          to these files by that name.
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            <b className="text-[#2f6b25]">{ok} uploaded</b>
            {busy > 0 && (
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {busy} waiting
              </span>
            )}
            {bad > 0 && <b className="text-destructive">{bad} rejected</b>}
            <span className="ml-auto flex gap-2">
              {bad > 0 && busy === 0 && (
                <Button size="sm" variant="outline" onClick={retry}>
                  Retry rejected
                </Button>
              )}
              {busy === 0 && (
                <Button size="sm" variant="ghost" onClick={() => setItems([])}>
                  Clear list
                </Button>
              )}
            </span>
          </div>
          <ul className="max-h-72 divide-y overflow-auto rounded-xl border text-[13px]">
            {shown.map((i) => (
              <li key={i.key} className="flex items-start gap-2.5 px-3 py-2">
                <span className="mt-0.5 shrink-0">
                  {i.status === "ok" ? (
                    <Check className="size-4 text-[#2f6b25]" />
                  ) : i.status === "error" ? (
                    <X className="size-4 text-destructive" />
                  ) : i.status === "uploading" ? (
                    <Loader2 className="size-4 animate-spin text-brand" />
                  ) : (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono [overflow-wrap:anywhere]">
                    {i.file.name}
                  </span>
                  {i.status === "ok" && i.info && (
                    <span className="block text-xs text-muted-foreground">
                      Drawing {i.info.drawingNumber}
                      {i.info.voltageV != null &&
                        ` · ${i.info.voltageV} V · ${i.info.ah} Ah`}
                      {i.info.alreadyUploaded && " · already uploaded"}
                    </span>
                  )}
                  {i.status === "ok" && i.info?.note && (
                    <span className="flex items-start gap-1 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      {i.info.note}
                    </span>
                  )}
                  {i.status === "error" && (
                    <span className="block text-xs font-semibold text-destructive">
                      {i.message}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {fmtSize(i.file.size)}
                </span>
              </li>
            ))}
          </ul>
          {items.length > SHOW && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Showing {SHOW} of {items.length.toLocaleString()} files (problems
              first).
            </p>
          )}
        </div>
      )}
    </div>
  );
}