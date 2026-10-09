import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Copy, ExternalLink, Eye, Files, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { DrawingFileItem, Paged } from "@/lib/types";
import { useDebounced } from "@/lib/hooks";
import { fmtDateTime, fmtSize } from "@/lib/util";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Advisory,
  Card2,
  Empty,
  ErrorState,
  PageHeader,
  Pill,
  notify,
} from "@/components/app/common";
import { DataTable } from "@/components/app/data-table";
import { FilterSelect } from "@/components/app/fields";

const copy = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify.ok(`${what} copied`);
  } catch {
    notify.err("Copy failed — select the text and press Ctrl+C");
  }
};

export default function DrawingFilesPage() {
  const [view, setView] = useState<DrawingFileItem | null>(null);
  const [f, setF] = useState({ q: "", usage: "", page: 1, pageSize: 25 });
  const q = useDebounced(f.q);
  const list = useQuery({
    queryKey: ["drawing-files", { ...f, q }],
    queryFn: () =>
      api.get<Paged<DrawingFileItem>>("/api/files/drawings", {
        q,
        unusedOnly: f.usage === "unused",
        page: f.page,
        pageSize: f.pageSize,
      }),
    staleTime: 0,
    placeholderData: keepPreviousData,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...p }));
  const columns: ColumnDef<DrawingFileItem>[] = [
    {
      header: "File",
      cell: ({ row: { original: d } }) => (
        <div className="min-w-0">
          <div className="truncate font-medium" title={d.name}>
            {d.name}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {d.id}
          </div>
        </div>
      ),
    },
    {
      header: "Type",
      cell: ({ row }) => (
        <Pill dot={false}>
          {row.original.extension.replace(".", "").toUpperCase() || "—"}
        </Pill>
      ),
    },
    {
      header: "Size",
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtSize(row.original.sizeBytes)}
        </span>
      ),
    },
    {
      header: "Uploaded",
      cell: ({ row: { original: d } }) => (
        <div className="whitespace-nowrap">
          <div>{fmtDateTime(d.uploadedAtUtc)}</div>
          <div className="text-xs text-muted-foreground">
            {d.uploadedByName ?? "—"}
          </div>
        </div>
      ),
    },
    {
      header: "Used by",
      cell: ({ row: { original: d } }) =>
        d.usedByCount === 0 ? (
          <Pill tone="amber" dot={false}>
            Not used yet
          </Pill>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
          
            <Button
              type="button"
              size="sm"
              variant="link"
              className="h-7 px-2.5 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setView(d);
              }}
            >
           
              <Pill tone="orange" dot={false}>
           {d.usedByCount} drawing{d.usedByCount > 1 ? "s" : ""} 
          </Pill>
            
            </Button>
          </div>
        ),
    },
    {
      header: "URL for bulk Excel",
      cell: ({ row: { original: d } }) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            title="Click to copy"
            className="max-w-[200px] truncate rounded-md border bg-panel px-2 py-1 text-left font-mono text-[11px] hover:border-brand"
            onClick={(e) => {
              e.stopPropagation();
              void copy(d.absoluteUrl, "URL");
            }}
          >
            {d.absoluteUrl}
          </button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Copy URL"
            onClick={(e) => {
              e.stopPropagation();
              void copy(d.absoluteUrl, "URL");
            }}
          >
            <Copy />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8"
            aria-label="Open file"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`${d.url}?inline=true`, "_blank", "noopener");
            }}
          >
            <ExternalLink />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        admin
        title="Uploaded files"
        sub="Every drawing file uploaded to the portal. Copy a file's URL and paste it in the DrawingUrl column of the bulk import sheet — no need to upload the same drawing again."
      />
      <Advisory
        tone="blue"
        title="Reuse instead of re-uploading"
        className="mb-4"
      >
        If a drawing file is already here, copy its URL and use it for any
        number of drawings (bulk Excel, Upload drawing or a revision). Search by
        file name, file id or a drawing number that uses it.
      </Advisory>
      <Card2 className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="relative w-full max-w-[340px]">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="File name, file id or drawing number"
              aria-label="Search uploaded files"
              className="h-9 pl-9"
            />
          </div>
          <FilterSelect
            label="Usage"
            className="w-44"
            value={f.usage}
            onChange={(v) => set({ usage: v })}
            placeholder="All files"
            options={[{ value: "unused", label: "Not used by any drawing" }]}
          />
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey={(d) => d.id}
            onRowClick={(d) => d.usedByCount > 0 && setView(d)}
            page={f.page}
            pageSize={f.pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => setF((x) => ({ ...x, page: p }))}
            onPageSize={(n) => set({ pageSize: n })}
            empty={<Empty icon={Files} title="No uploaded files match" />}
          />
        )}
      </Card2>
      {view && <UsageDialog file={view} onClose={() => setView(null)} />}
    </>
  );
}

function UsageDialog({
  file,
  onClose,
}: {
  file: DrawingFileItem;
  onClose: () => void;
}) {
  const ids = new Set(file.usedBy.map((u) => u.drawingId));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-6 py-5 text-left">
          <DialogTitle className="pr-8 break-all">{file.name}</DialogTitle>
          <DialogDescription>
            Used by {ids.size} drawing{ids.size > 1 ? "s" : ""} ·{" "}
            {fmtSize(file.sizeBytes)} · uploaded{" "}
            {fmtDateTime(file.uploadedAtUtc)}
            {file.uploadedByName ? ` by ${file.uploadedByName}` : ""}
          </DialogDescription>
          <div className="mt-3 flex gap-2">
            <Input
              readOnly
              value={file.absoluteUrl}
              aria-label="File URL"
              className="h-9 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void copy(file.absoluteUrl, "URL")}
            >
              <Copy />
              Copy URL
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-panel text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <tr>
                {[
                  "Drawing no.",
                  "Status",
                  "File version",
                  "Make · Category",
                  "Vehicle type · Model",
                  "Voltage · Ah",
                  "Connector",
                  "L × W × H (mm)",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-3 py-2.5 font-semibold whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {file.usedBy.map((u) => (
                <tr key={u.drawingId + u.revisionNo} className="align-top">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link
                      to={`/drawings/${u.drawingId}`}
                      className="font-mono font-semibold text-brand hover:underline"
                    >
                      {u.drawingNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Pill
                      dot={false}
                      tone={u.status === "Active" ? "green" : "grey"}
                    >
                      {u.status}
                    </Pill>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {u.isCurrentFile ? (
                      <Pill dot={false} tone="blue">
                        Current · Rev {u.currentRevisionNo}
                      </Pill>
                    ) : (
                      <Pill dot={false}>Old · Rev {u.revisionNo}</Pill>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{u.make}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.category}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">
                      {u.model}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({u.capacity})
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {u.vehicleType}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {u.voltageV} V · {u.ah}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {u.connector}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
                    {u.size.replace(" mm", "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {file.usedByCount > ids.size && (
            <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              Showing the first {ids.size} of {file.usedByCount} drawings.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
