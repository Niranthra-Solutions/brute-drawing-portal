import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Download, ExternalLink, FileText, Maximize2 } from "lucide-react";
import type { Drawing, RequestDetail } from "@/lib/types";
import { fileUrl } from "@/lib/util";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SectionCard } from "./common";

interface Item {
  key: string;
  fileId: string | null;
  name: string;
  canPreview: boolean;
  caption: string;
  to?: string;
}
interface Pane {
  badge: string;
  tone: "grey" | "orange" | "green";
  items: Item[];
  placeholder: string;
}

const TONE = {
  grey: "bg-white/15 text-white",
  orange: "bg-brand text-white",
  green: "bg-success text-white",
} as const;

const drawingItem = (d: Drawing, caption: string): Item => ({
  key: "d-" + d.id,
  fileId: d.fileId,
  name: d.fileName ?? d.drawingNumber,
  canPreview: d.canPreview,
  caption: `${caption} · ${d.drawingNumber}`,
  to: `/drawings/${d.id}`,
});

function Preview({ item, className }: { item?: Item; className?: string }) {
  if (!item) return null;
  if (item.fileId && item.canPreview)
    return /\.pdf$/i.test(item.name) ? (
      <iframe
        title={item.caption}
        src={fileUrl(item.fileId, true) + "#toolbar=0&view=FitH"}
        className={cn("size-full border-0 bg-white", className)}
      />
    ) : (
      <img
        alt={item.caption}
        src={fileUrl(item.fileId, true)}
        className={cn("size-full object-contain", className)}
      />
    );
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/60">
      <FileText className="size-8" />
      <div className="font-semibold text-white/80 [overflow-wrap:anywhere]">
        {item.name}
      </div>
      <div>No in-browser preview for this file type.</div>
      {item.fileId && (
        <Button asChild size="sm" variant="secondary">
          <a href={fileUrl(item.fileId)}>
            <Download />
            Download
          </a>
        </Button>
      )}
    </div>
  );
}

function PaneView({
  pane,
  big,
  onExpand,
}: {
  pane: Pane;
  big?: boolean;
  onExpand?: () => void;
}) {
  const [i, setI] = useState(0);
  const item = pane.items[Math.min(i, pane.items.length - 1)];
  return (
    <div>
      <div
        className={cn(
          "group corners relative overflow-hidden rounded-2xl bg-[#1f2024]",
          big ? "h-[70vh]" : "h-[260px]",
        )}
      >
        <span className="pointer-events-none absolute right-2.5 top-2.5 z-[2] size-4 border-t-2 border-r-2 border-brand/60" />
        <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[2] size-4 border-b-2 border-l-2 border-brand/60" />
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={item?.key ?? "empty"}
              className="size-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {item ? (
                <Preview item={item} />
              ) : (
                <div className="flex size-full items-center justify-center text-sm text-white/40">
                  {pane.placeholder}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        <span
          className={cn(
            "absolute top-3 left-4 z-[3] rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide backdrop-blur",
            TONE[pane.tone],
          )}
        >
          {pane.badge}
        </span>
        {onExpand && item && (
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute right-4 bottom-3 z-[3] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            onClick={onExpand}
            aria-label={`Expand ${pane.badge}`}
          >
            <Maximize2 />
          </Button>
        )}
      </div>
      <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
        {pane.items.length > 1 &&
          pane.items.map((it, n) => (
            <button
              key={it.key}
              type="button"
              onClick={() => setI(n)}
              className={cn(
                "max-w-[190px] truncate rounded-full border px-2.5 py-1 text-[11.5px] font-semibold",
                n === i
                  ? "border-brand bg-brand-soft text-brand-dark"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {it.caption}
            </button>
          ))}
        {pane.items.length === 1 && (
          <span className="truncate text-xs text-muted-foreground">
            {item?.caption}
          </span>
        )}
        <span className="ml-auto flex gap-1.5">
          {item?.to && (
            <Button asChild variant="ghost" size="xs">
              <Link to={item.to}>
                <ExternalLink />
                Open
              </Link>
            </Button>
          )}
          {item?.fileId && (
            <Button asChild variant="ghost" size="xs">
              <a href={fileUrl(item.fileId)}>
                <Download />
                Download
              </a>
            </Button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Shows ONLY the revised / newly uploaded drawing of a completed request (the requester's reference files stay in the attachments list with View / Download). */
export function VisualComparison({ r }: { r: RequestDetail }) {
  const d = r.resultDrawing;
  const pane = useMemo<Pane | null>(
    () =>
      d
        ? {
            badge: `${r.type === "New" ? "NEW DRAWING" : "REVISED"}: REV ${d.revisionLabel}`,
            tone: "green",
            items: [drawingItem(d, `Rev ${d.revisionLabel}`)],
            placeholder: "Drawing",
          }
        : null,
    [d, r.type],
  );
  const [open, setOpen] = useState(false);
  if (!pane) return null;
  return (
    <>
      <SectionCard
        icon={Maximize2}
        title={r.type === "New" ? "New drawing" : "Revised drawing"}
      >
        <PaneView pane={pane} onExpand={() => setOpen(true)} />
      </SectionCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[min(1400px,96vw)]">
          <DialogHeader>
            <DialogTitle>
              {pane.badge} · {r.ticketNo}
            </DialogTitle>
            <DialogDescription>{pane.items[0].caption}</DialogDescription>
          </DialogHeader>
          <PaneView pane={pane} big />
        </DialogContent>
      </Dialog>
    </>
  );
}
