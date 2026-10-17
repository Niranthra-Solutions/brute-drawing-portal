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
      <Button asChild variant="outline" size="icon-sm" title="View drawing">
        <Link to={`/drawings/${d.id}`} aria-label={`View ${d.drawingNumber}`}>
          <Eye />
        </Link>
      </Button>
      {d.fileId && (
        <Button asChild variant="outline" size="icon-sm" title="Download">
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
