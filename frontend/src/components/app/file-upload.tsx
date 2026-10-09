import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, UploadCloud } from "lucide-react";
import { upload } from "@/lib/api";
import type { UploadedFile } from "@/lib/types";
import { fmtDateTime, fmtSize } from "@/lib/util";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CopyField, errMsg, notify } from "./common";

/** Drag-and-drop uploader with real progress. Uploads immediately and returns the stored file (id + generated URL). */
export function FileUpload({
  endpoint,
  accept,
  onUploaded,
  onCleared,
  value,
  showUrl,
  hint,
  compact,
}: {
  endpoint: string;
  accept: string;
  onUploaded: (f: UploadedFile) => void;
  onCleared?: () => void;
  value?: UploadedFile | null;
  showUrl?: boolean;
  hint?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [pct, setPct] = useState<number | null>(null);
  const [err, setErr] = useState<string>();
  const send = async (file?: File) => {
    if (!file) return;
    setErr(undefined);
    setPct(0);
    try {
      const up = await upload<UploadedFile>(endpoint, file, setPct);
      if (up.alreadyExisted)
        notify.ok(
          "This file was already uploaded — using the existing link. Nothing new was saved.",
        );
      onUploaded(up);
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setPct(null);
    }
  };
  return (
    <div>
      <motion.div
        animate={{ scale: over ? 1.01 : 1 }}
        className={cn(
          "rounded-2xl border-[1.5px] border-dashed bg-panel text-center text-[13px] text-muted-foreground transition-colors",
          compact ? "p-4" : "p-7",
          over && "border-brand bg-brand-soft/40",
          value && "border-solid border-success/40 bg-success-soft/30",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void send(e.dataTransfer.files[0]);
        }}
      >
        <input
          ref={input}
          type="file"
          accept={accept}
          hidden
          onChange={(e) => {
            void send(e.target.files?.[0]);
            e.target.value = "";
          }}
          data-testid="file-input"
        />
        {pct !== null ? (
          <div>
            <div className="mb-3 font-bold text-foreground">
              Uploading… {pct}%
            </div>
            <Progress value={pct} />
          </div>
        ) : value ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Check className="size-4 text-success" />
            <span className="font-bold text-foreground">{value.name}</span>
            <span>{fmtSize(value.sizeBytes)}</span>
            {value.alreadyExisted && (
              <span className="basis-full text-xs font-semibold text-info">
                Already uploaded
                {value.firstUploadedAtUtc
                  ? ` on ${fmtDateTime(value.firstUploadedAtUtc)}`
                  : ""}{" "}
                — existing file and link reused, nothing saved again.
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => input.current?.click()}
            >
              Replace
            </Button>
            {onCleared && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCleared}
              >
                Remove
              </Button>
            )}
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto mb-2 size-7 text-brand" />
            <div>
              <b className="text-foreground">Drag & drop</b> a file here, or{" "}
              <button
                type="button"
                className="font-bold text-brand-dark underline-offset-2 hover:underline"
                onClick={() => input.current?.click()}
              >
                browse
              </button>
            </div>
            <div className="mt-1 text-xs">{hint ?? accept}</div>
          </>
        )}
      </motion.div>
      {err && (
        <p
          role="alert"
          className="mt-1.5 text-xs font-semibold text-destructive"
        >
          {err}
        </p>
      )}
      {value && showUrl && (
        <div className="mt-4">
          <div className="mb-1.5 text-xs font-bold">Generated drawing URL</div>
          <CopyField value={value.absoluteUrl} label="Generated drawing URL" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Saved in the database. Paste this URL into the DrawingUrl column of
            the bulk-import Excel file.
          </p>
        </div>
      )}
    </div>
  );
}
