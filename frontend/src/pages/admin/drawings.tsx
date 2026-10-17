import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  Database,
  Eye,
  Layers,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { Drawing, Paged } from "@/lib/types";
import { fmtDate } from "@/lib/util";
import { useBootstrap, useDebounced } from "@/lib/hooks";
import { useFilters } from "@/stores/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card2,
  ConfirmDialog,
  Empty,
  ErrorState,
  PageHeader,
  StatusBadge,
  notify,
} from "@/components/app/common";
import { DataTable } from "@/components/app/data-table";
import { FilterSelect } from "@/components/app/fields";
import { Dims, DrawingNo } from "@/components/app/drawing-bits";

export default function DrawingsAdminPage() {
  const { data: b } = useBootstrap();
  const nav = useNavigate();
  const qc = useQueryClient();
  const f = useFilters((s) => s.drawings);
  const set = useFilters((s) => s.set);
  const reset = useFilters((s) => s.reset);
  const q = useDebounced(f.q);
  const [del, setDel] = useState<Drawing | null>(null);
  const list = useQuery({
    queryKey: ["drawings", { ...f, q }],
    queryFn: () =>
      api.get<Paged<Drawing>>("/api/drawings", {
        q,
        categoryId: f.categoryId,
        makeId: f.makeId,
        voltageV: f.voltageV,
        status: f.status,
        sort: f.sort,
        dir: f.dir,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const sort = (field: string) =>
    set("drawings", {
      sort: field,
      dir: f.sort === field && f.dir === "asc" ? "desc" : "asc",
    });
  const filtered = !!(
    f.q ||
    f.categoryId ||
    f.makeId ||
    f.voltageV ||
    f.status
  );
  const columns: ColumnDef<Drawing>[] = [
    {
      header: "ID",
      meta: { className: "w-16" },
      cell: ({ row: { original: d } }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {d.serial}
        </span>
      ),
    },
    {
      header: "Drawing no.",
      meta: { sort: "number" },
      cell: ({ row: { original: d } }) => (
        <>
          <DrawingNo>{d.drawingNumber}</DrawingNo>
          <div className="text-xs text-muted-foreground">
            Rev {d.revisionLabel}
          </div>
        </>
      ),
    },
    { header: "Category", cell: ({ row }) => row.original.category },
    {
      header: "Make",
      meta: { sort: "make" },
      cell: ({ row }) => row.original.make,
    },
    {
      header: "Model",
      meta: { sort: "model" },
      cell: ({ row: { original: d } }) => (
        <>
          {d.model}
          <div className="text-xs text-muted-foreground">
            {d.vehicleType} · {d.capacity}
          </div>
        </>
      ),
    },
    {
      header: "V",
      meta: { sort: "voltage" },
      cell: ({ row }) => row.original.voltageV,
    },
    { header: "Ah", meta: { sort: "ah" }, cell: ({ row }) => row.original.ah },
    { header: "L × W × H", cell: ({ row }) => <Dims d={row.original} /> },
    { header: "Connector", cell: ({ row }) => row.original.connector },
    {
      header: "Status",
      meta: { sort: "status" },
      cell: ({ row }) => <StatusBadge s={row.original.status} />,
    },
    {
      header: "Updated",
      meta: { sort: "updated" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {fmtDate(row.original.updatedAtUtc)}
        </span>
      ),
    },
    {
      id: "a",
      header: "",
      cell: ({ row: { original: d } }) => (
        <div
          className="flex justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button asChild variant="outline" size="icon-sm">
            <Link
              to={`/drawings/${d.id}`}
              aria-label={`View ${d.drawingNumber}`}
            >
              <Eye />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon-sm">
            <Link
              to={`/admin/drawings/${d.id}/edit`}
              aria-label={`Modify ${d.drawingNumber}`}
            >
              <Pencil />
            </Link>
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={() => setDel(d)}
            aria-label={`Delete ${d.drawingNumber}`}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Master database"
        admin
        title="All drawings"
        sub="Every drawing in the library. View, modify, add revisions or delete — changes reflect on the Marketing search immediately."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/admin/bulk-import">
                <Layers />
                Bulk import
              </Link>
            </Button>
            <Button asChild>
              <Link to="/admin/drawings/new">
                <Upload />
                Upload drawing
              </Link>
            </Button>
          </>
        }
      />
      <Card2 className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="relative w-full max-w-[300px]">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={f.q}
              onChange={(e) => set("drawings", { q: e.target.value })}
              placeholder="Drawing no., make, model…"
              aria-label="Search drawings"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Category"
              value={f.categoryId as string}
              onChange={(v) => set("drawings", { categoryId: v })}
              placeholder="Category"
              options={(b?.categories ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
            <FilterSelect
              label="Make"
              value={f.makeId as string}
              onChange={(v) => set("drawings", { makeId: v })}
              placeholder="Make"
              options={(b?.makes ?? []).map((c) => ({
                value: c.id,
                label: c.name,
              }))}
            />
            <FilterSelect
              label="Voltage"
              className="w-28"
              value={f.voltageV as string}
              onChange={(v) => set("drawings", { voltageV: v })}
              placeholder="Voltage"
              options={(b?.voltages ?? []).map((v) => ({
                value: String(v.valueV),
                label: `${v.valueV} V`,
              }))}
            />
            <FilterSelect
              label="Status"
              className="w-32"
              value={f.status as string}
              onChange={(v) => set("drawings", { status: v })}
              placeholder="Status"
              options={[
                { value: "Active", label: "Active" },
                { value: "Archived", label: "Archived" },
              ]}
            />
            {filtered && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => reset("drawings")}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            sort={f.sort}
            dir={f.dir}
            onSort={sort}
            rowKey={(d) => d.id}
            onRowClick={(d) => nav(`/drawings/${d.id}`)}
            page={f.page}
            pageSize={f.pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => set("drawings", { page: p })}
            onPageSize={(n) => set("drawings", { pageSize: n })}
            empty={
              <Empty
                icon={Database}
                title="No drawings found"
                action={
                  filtered ? undefined : (
                    <Button asChild>
                      <Link to="/admin/drawings/new">
                        Upload the first drawing
                      </Link>
                    </Button>
                  )
                }
              >
                {filtered
                  ? "No drawings match these filters."
                  : "The library is empty."}
              </Empty>
            }
          />
        )}
      </Card2>
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        danger
        title="Delete drawing?"
        confirmLabel="Delete"
        message={
          <>
            Delete <b>{del?.drawingNumber}</b>? It disappears from search
            immediately. An audit record is kept.
          </>
        }
        onConfirm={async () => {
          await api.del(`/api/drawings/${del!.id}`);
          qc.invalidateQueries({ queryKey: ["drawings"] });
          notify.ok("Drawing deleted");
        }}
      />
    </>
  );
}
