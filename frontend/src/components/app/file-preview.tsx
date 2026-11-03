import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { fileUrl } from "@/lib/util";
import {
  previewPptx,
  previewXlsx,
  type SheetPreview,
  type SlidePreview,
} from "@/lib/office-preview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/app/common";

export type PreviewKind = "video" | "xlsx" | "pptx" | null;
/** Files that open in the in-app viewer. PDFs and images keep opening in the browser's own viewer. */
export const previewKind = (ext: string): PreviewKind => {
  const e = ext.replace(".", "").toLowerCase();
  if (["mp4", "mov", "m4v", "webm"].includes(e)) return "video";
  if (e === "xlsx") return "xlsx";
  if (e === "pptx") return "pptx";
  return null;
};

export interface PreviewTarget {
  fileId: string;
  title: string;
  ext: string;
}

export function FilePreview({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const kind = target ? previewKind(target.ext) : null;
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0 sm:max-w-5xl">
        {target && (
          <div className="flex max-h-[92vh] min-w-0 flex-col">
            <DialogHeader className="border-b px-5 py-4">
              <DialogTitle>{target.title}</DialogTitle>
              <DialogDescription>
                Quick view — download the file for the original.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 min-w-0 flex-1 overflow-auto p-4">
              {kind === "video" && <VideoView t={target} />}
              {kind === "xlsx" && <SheetsView t={target} />}
              {kind === "pptx" && <SlidesView t={target} />}
            </div>
            <div className="flex justify-end border-t px-5 py-3">
              <Button asChild variant="outline">
                <a href={fileUrl(target.fileId)}>
                  <Download />
                  Download
                </a>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function VideoView({ t }: { t: PreviewTarget }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <p className="p-6 text-center text-muted-foreground">
      This browser cannot play this video format (some .mov / HEVC files need a
      desktop player). Use Download to watch it.
    </p>
  ) : (
    <video
      key={t.fileId}
      className="max-h-[70vh] w-full rounded-lg bg-black"
      controls
      autoPlay
      preload="metadata"
      src={fileUrl(t.fileId, true)}
      onError={() => setFailed(true)}
    />
  );
}

/** Loads the file once and parses it with `parse`. */
function useParsed<T>(t: PreviewTarget, parse: (b: ArrayBuffer) => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    let alive = true;
    setState({});
    (async () => {
      try {
        const res = await fetch(fileUrl(t.fileId, true), {
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Could not load the file.");
        const data = await parse(await res.arrayBuffer());
        if (alive) setState({ data });
      } catch (e) {
        if (alive)
          setState({
            error:
              e instanceof Error ? e.message : "Could not preview this file.",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [t.fileId]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

const Wait = ({ error }: { error?: string }) =>
  error ? (
    <p className="p-6 text-center text-muted-foreground">
      {error} Use Download to open it.
    </p>
  ) : (
    <div className="flex justify-center p-10">
      <Spinner />
    </div>
  );

function SheetsView({ t }: { t: PreviewTarget }) {
  const { data, error } = useParsed<SheetPreview[]>(t, previewXlsx);
  const [i, setI] = useState(0);
  if (!data) return <Wait error={error} />;
  const s = data[Math.min(i, data.length - 1)];
  const cols = Math.max(1, ...s.rows.map((r) => r.length));
  return (
    <div>
      <div className="mb-3 flex max-w-full gap-1.5 overflow-x-auto pb-1">
        {data.map((x, k) => (
          <Button
            key={x.name + k}
            size="sm"
            className="shrink-0"
            variant={k === i ? "default" : "outline"}
            onClick={() => setI(k)}
          >
            {x.name}
          </Button>
        ))}
      </div>
      <div className="max-h-[60vh] max-w-full overflow-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {s.rows.map((r, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-panel font-bold" : ""}>
                {Array.from({ length: cols }, (_, ci) => (
                  <td key={ci} className="border px-2 py-1 whitespace-nowrap">
                    {r[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {s.truncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the first rows only — download the file to see everything.
        </p>
      )}
    </div>
  );
}

function SlidesView({ t }: { t: PreviewTarget }) {
  const { data, error } = useParsed<SlidePreview[]>(t, previewPptx);
  useEffect(
    () => () => data?.forEach((s) => s.images.forEach(URL.revokeObjectURL)),
    [data],
  );
  if (!data) return <Wait error={error} />;
  return (
    <div className="grid gap-4">
      {data.map((s) => (
        <div key={s.n} className="rounded-xl border bg-card p-5">
          <div className="mb-2 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Slide {s.n}
          </div>
          {s.paragraphs.map((p, k) => (
            <p key={k} className={k === 0 ? "text-[15px] font-bold" : "mt-1"}>
              {p}
            </p>
          ))}
          {s.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {s.images.map((u, k) => (
                <img
                  key={k}
                  src={u}
                  alt=""
                  className="max-h-60 rounded-lg border object-contain"
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}