import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ScrollText, Search } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { Audit, Paged } from "@/lib/types";
import { useDebounced } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/util";
import { Input } from "@/components/ui/input";
import {
  Card2,
  Empty,
  ErrorState,
  PageHeader,
  Pill,
} from "@/components/app/common";
import { DataTable } from "@/components/app/data-table";
import { FilterSelect } from "@/components/app/fields";

const TYPES = [
  "Drawing",
  "Request",
  "User",
  "Settings",
  "Document",
  "BulkImport",
  "models",
  "makes",
  "categories",
  "vehicle-types",
  "connectors",
  "voltages",
  "ah-ratings",
];

export default function AuditPage() {
  const [f, setF] = useState({
    q: "",
    entityType: "",
    from: "",
    to: "",
    page: 1,
    pageSize: 50,
  });
  const q = useDebounced(f.q);
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["audit", { ...f, q }],
    queryFn: () =>
      api.get<Paged<Audit>>("/api/audit", {
        q,
        entityType: f.entityType,
        from: f.from,
        to: f.to,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, page: 1, ...p }));
  const columns: ColumnDef<Audit>[] = [
    {
      id: "x",
      header: "",
      meta: { className: "w-8" },
      cell: ({ row: { original: a } }) =>
        a.detailsJson ? (
          open === a.id ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )
        ) : null,
    },
    {
      header: "When",
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {fmtDateTime(row.original.createdAtUtc)}
        </span>
      ),
    },
    { header: "User", cell: ({ row }) => row.original.actorEmail },
    {
      header: "Action",
      cell: ({ row }) => <Pill dot={false}>{row.original.action}</Pill>,
    },
    {
      header: "Summary",
      cell: ({ row: { original: a } }) => (
        <>
          <div>{a.summary}</div>
          {open === a.id && a.detailsJson && (
            <pre className="mt-2 max-h-60 overflow-auto rounded-lg border bg-panel p-3 font-mono text-[11.5px]">
              {JSON.stringify(JSON.parse(a.detailsJson), null, 2)}
            </pre>
          )}
        </>
      ),
    },
    {
      header: "IP",
      cell: ({ row }) => (
        <span className="font-mono text-muted-foreground">
          {row.original.ipAddress ?? "—"}
        </span>
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        admin
        title="Audit log"
        sub="An append-only record of sign-ins, drawing changes, request decisions, master-data and settings edits."
      />
      <Card2 className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="relative w-full max-w-[300px]">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={f.q}
              onChange={(e) => set({ q: e.target.value })}
              placeholder="Summary, user or id"
              aria-label="Search audit log"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Entity"
              className="w-40"
              value={f.entityType}
              onChange={(v) => set({ entityType: v })}
              placeholder="All entities"
              options={TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Input
              type="date"
              className="h-9 w-40"
              value={f.from}
              onChange={(e) => set({ from: e.target.value })}
              aria-label="From date"
            />
            <Input
              type="date"
              className="h-9 w-40"
              value={f.to}
              onChange={(e) => set({ to: e.target.value })}
              aria-label="To date"
            />
          </div>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            data={list.data?.items ?? []}
            loading={list.isLoading}
            rowKey={(a) => a.id}
            onRowClick={(a) =>
              a.detailsJson && setOpen(open === a.id ? null : a.id)
            }
            page={f.page}
            pageSize={f.pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => setF((x) => ({ ...x, page: p }))}
            onPageSize={(n) => set({ pageSize: n })}
            empty={<Empty icon={ScrollText} title="No audit entries match" />}
          />
        )}
      </Card2>
    </>
  );
}
