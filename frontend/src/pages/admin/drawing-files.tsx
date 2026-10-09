import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Copy, ExternalLink, Files, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { DrawingFileItem, Paged } from "@/lib/types";
import { useDebounced } from "@/lib/hooks";
import { fmtDateTime, fmtSize } from "@/lib/util";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
      header: "Used by drawings",
      meta: { className: "min-w-[420px]" },
      cell: ({ row: { original: d } }) =>
        d.usedByCount === 0 ? (
          <Pill tone="amber" dot={false}>
            Not used by any drawing yet
          </Pill>
        ) : (
          <div className="space-y-1.5">
            <div className="text-xs font-semibold">
              {d.usedByCount} drawing{d.usedByCount > 1 ? "s" : ""} use this
              file
            </div>
            {d.usedBy.map((u) => (
              <div
                key={u.drawingId + u.revisionNo}
                className="rounded-lg border bg-panel px-2.5 py-1.5 text-xs leading-5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Link
                    to={`/drawings/${u.drawingId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-[12px] font-semibold text-brand hover:underline"
                  >
                    {u.drawingNumber}
                  </Link>
                  <Pill
                    dot={false}
                    tone={u.status === "Active" ? "green" : "grey"}
                  >
                    {u.status}
                  </Pill>
                  {u.isCurrentFile ? (
                    <Pill dot={false} tone="blue">
                      Current file · Rev {u.currentRevisionNo}
                    </Pill>
                  ) : (
                    <Pill dot={false}>Old revision {u.revisionNo}</Pill>
                  )}
                </div>
                <div className="text-muted-foreground">
                  {u.category} › {u.make} › {u.vehicleType} › {u.model} (
                  {u.capacity})
                </div>
                <div className="text-muted-foreground">
                  {u.voltageV} V · {u.ah} Ah · {u.connector} · {u.size}
                </div>
              </div>
            ))}
            {d.usedByCount > new Set(d.usedBy.map((u) => u.drawingId)).size && (
              <div className="text-xs text-muted-foreground">
                …and{" "}
                {d.usedByCount - new Set(d.usedBy.map((u) => u.drawingId)).size}{" "}
                more
              </div>
            )}
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
            className="max-w-[260px] truncate rounded-md border bg-panel px-2 py-1 text-left font-mono text-[11px] hover:border-brand"
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
            page={f.page}
            pageSize={f.pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => setF((x) => ({ ...x, page: p }))}
            onPageSize={(n) => set({ pageSize: n })}
            empty={<Empty icon={Files} title="No uploaded files match" />}
          />
        )}
      </Card2>
    </>
  );
}
