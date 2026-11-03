import { Link } from "react-router-dom";
import { Download, Eye, Pencil } from "lucide-react";
import type { Drawing } from "@/lib/types";
import { fileUrl } from "@/lib/util";
import { Button } from "@/components/ui/button";

/** `modify` shows the Modify (request) button for non-admins - only pass it for the LATEST revision of a drawing. */
export function DrawingActions({
  d,
  admin,
  modify,
}: {
  d: Drawing;
  admin?: boolean;
  modify?: boolean;
}) {
  return (
    <div
      className="flex justify-end gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        asChild
        variant="outline"
        size="icon-sm"
        title="View drawing"
        className="border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 hover:text-sky-800"
      >
        <Link to={`/drawings/${d.id}`} aria-label={`View ${d.drawingNumber}`}>
          <Eye />
        </Link>
      </Button>
      {d.fileId && (
        <Button
          asChild
          variant="outline"
          size="icon-sm"
          title="Download"
          className="border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
        >
          <a
            href={fileUrl(d.fileId)}
            aria-label={`Download ${d.drawingNumber}`}
          >
            <Download />
          </a>
        </Button>
      )}
      {admin ? (
        <Button asChild variant="outline" size="icon-sm" title="Edit">
          <Link
            to={`/admin/drawings/${d.id}/edit`}
            aria-label={`Edit ${d.drawingNumber}`}
          >
            <Pencil />
          </Link>
        </Button>
      ) : (
        modify && (
          <Button
            asChild
            variant="outline"
            size="icon-sm"
            title="Request modification"
            className="border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800"
          >
            <Link
              to={`/requests/modify?drawingId=${d.id}`}
              aria-label={`Request modification of ${d.drawingNumber}`}
            >
              <Pencil />
            </Link>
          </Button>
        )
      )}
    </div>
  );
}
export const Dims = ({
  d,
}: {
  d: Pick<Drawing, "lengthMm" | "widthMm" | "heightMm">;
}) => (
  <span className="font-mono">
    {d.lengthMm} × {d.widthMm} × {d.heightMm}
  </span>
);
export const signed = (n: number) => (n === 0 ? "0" : n > 0 ? `+${n}` : `${n}`);
export const DrawingNo = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-[12.5px] font-semibold text-brand-dark">
    {children}
  </span>
);

/** Vehicle cell: "Linde E16H" with "Imports · Reach Truck · 1.6 T" beneath (category, type and capacity). */
export const VehicleCell = ({
  d,
}: {
  d: Pick<Drawing, "make" | "model" | "category" | "vehicleType" | "capacity">;
}) => (
  <div>
    <div className="font-semibold">
      {d.make} {d.model}
    </div>
    <div className="text-xs text-muted-foreground">
      {[d.category, d.vehicleType, d.capacity].filter(Boolean).join(" · ")}
    </div>
  </div>
);

/** Comment for a drawing: the AFS / drain-hole note (highlighted) followed by the admin's own comment. */
export const DrawingComment = ({
  d,
}: {
  d: Pick<Drawing, "afsDrainText" | "comments">;
}) =>
  d.afsDrainText || d.comments ? (
    <div className="min-w-44 max-w-64 space-y-1 text-xs">
      {d.afsDrainText && (
        <div className="rounded-md bg-amber-100 px-2 py-1 font-semibold text-amber-900">
          {d.afsDrainText}
        </div>
      )}
      {d.comments && <div className="text-muted-foreground">{d.comments}</div>}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  );