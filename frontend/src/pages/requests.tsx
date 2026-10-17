import { Link, useNavigate } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  Check,
  Clock,
  Inbox,
  Pencil,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { Paged, RequestListItem, RequestStats } from "@/lib/types";
import { ago } from "@/lib/util";
import { useDebounced } from "@/lib/hooks";
import { useIsAdmin } from "@/stores/auth";
import { useFilters } from "@/stores/filters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card2,
  Empty,
  ErrorState,
  PageHeader,
  PriorityBadge,
  StatusBadge,
} from "@/components/app/common";
import { DataTable } from "@/components/app/data-table";
import { FilterSelect } from "@/components/app/fields";
import { cn } from "@/lib/utils";

export default function RequestsPage() {
  const admin = useIsAdmin();
  const nav = useNavigate();
  const f = useFilters((s) => s.requests);
  const set = useFilters((s) => s.set);
  const reset = useFilters((s) => s.reset);
  const q = useDebounced(f.q);
  const list = useQuery({
    queryKey: ["requests", { ...f, q }],
    queryFn: () =>
      api.get<Paged<RequestListItem>>("/api/requests", {
        q,
        type: f.type,
        status: f.status,
        priority: f.priority,
        scope: f.scope,
        sort: f.sort,
        dir: f.dir,
        page: f.page,
        pageSize: f.pageSize,
      }),
    placeholderData: keepPreviousData,
  });
  const stats = useQuery({
    queryKey: ["request-stats"],
    queryFn: () => api.get<RequestStats>("/api/requests/stats"),
  });
  const s = stats.data;
  const sort = (field: string) =>
    set("requests", {
      sort: field,
      dir: f.sort === field && f.dir === "desc" ? "asc" : "desc",
    });
  const columns: ColumnDef<RequestListItem>[] = [
    {
      header: "Ticket",
      meta: { sort: "ticket" },
      cell: ({ row: { original: r } }) => (
        <>
          <span className="font-mono text-[12.5px] font-semibold text-brand-dark">
            {r.ticketNo}
          </span>
          <div className="text-xs text-muted-foreground">
            {r.type === "New" ? "New drawing" : "Modification"}
          </div>
        </>
      ),
    },
    {
      header: "Request",
      cell: ({ row: { original: r } }) => (
        <>
          <div className="font-bold">{r.title}</div>
          {r.relatedDrawingNumber && (
            <div className="font-mono text-xs text-muted-foreground">
              {r.relatedDrawingNumber}
            </div>
          )}
        </>
      ),
    },
    ...(admin
      ? [
          {
            header: "Requester",
            cell: ({ row: { original: r } }) => (
              <>
                {r.requestedByName}
                <div className="text-xs text-muted-foreground">
                  {r.assignedToName ? `→ ${r.assignedToName}` : "Unassigned"}
                </div>
              </>
            ),
          } as ColumnDef<RequestListItem>,
        ]
      : []),
    {
      header: "Priority",
      meta: { sort: "priority" },
      cell: ({ row }) => <PriorityBadge p={row.original.priority} />,
    },
    {
      header: "Status",
      meta: { sort: "status" },
      cell: ({ row }) => <StatusBadge s={row.original.status} />,
    },
    {
      header: "Submitted",
      meta: { sort: "submitted" },
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {ago(row.original.submittedAtUtc)}
        </span>
      ),
    },
  ];
  const cards: [string, number | undefined, string, LucideIcon][] = [
    ["Total", s?.total, "bg-muted text-muted-foreground", Inbox],
    ["Open", s?.open, "bg-info-soft text-info", Clock],
    ["In progress", s?.inProgress, "bg-brand-soft text-brand-dark", Pencil],
    ["Completed", s?.completed, "bg-success-soft text-[#2f6b25]", Check],
  ];
  return (
    <>
      <PageHeader
        eyebrow="Requests"
        admin={admin}
        title={admin ? "All drawing requests" : "My drawing requests"}
        sub="Every request has a ticket, live status, e-mail notifications and a full audit trail."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/requests/modify">
                <Pencil />
                Modification request
              </Link>
            </Button>
            <Button asChild>
              <Link to="/requests/new">
                <Plus />
                New drawing request
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([l, v, t, I]) => (
          <Card2 key={l} className="flex min-h-24 flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {l}
              </span>
              <span
                className={cn(
                  "flex size-[30px] items-center justify-center rounded-[9px]",
                  t,
                )}
              >
                <I className="size-4" />
              </span>
            </div>
            <div className="font-heading text-2xl font-bold">{v ?? "—"}</div>
          </Card2>
        ))}
      </div>
      <Card2 className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          {f.scope && (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-dark">
              {f.scope === "open"
                ? admin
                  ? "Showing open requests"
                  : "Showing my open requests"
                : "Showing requests completed in the last 30 days"}
            </span>
          )}
          <div className="relative w-full max-w-[300px]">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              value={f.q}
              onChange={(e) => set("requests", { q: e.target.value })}
              placeholder="Ticket, title or drawing no."
              aria-label="Search requests"
              className="h-9 pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              label="Type"
              value={f.type as string}
              onChange={(v) => set("requests", { type: v })}
              placeholder="All types"
              options={[
                { value: "New", label: "New drawing" },
                { value: "Modification", label: "Modification" },
              ]}
            />
            <FilterSelect
              label="Status"
              value={f.status as string}
              onChange={(v) => set("requests", { status: v, scope: "" })}
              placeholder="All statuses"
              options={[
                "Submitted",
                "InReview",
                "Assigned",
                "InProgress",
                "Completed",
                "Rejected",
              ].map((x) => ({
                value: x,
                label:
                  x === "InReview"
                    ? "In review"
                    : x === "InProgress"
                      ? "In progress"
                      : x,
              }))}
            />
            <FilterSelect
              label="Priority"
              value={f.priority as string}
              onChange={(v) => set("requests", { priority: v })}
              placeholder="Any priority"
              options={["Standard", "High", "Critical"].map((x) => ({
                value: x,
                label: x,
              }))}
            />
            {(f.q || f.type || f.status || f.priority || f.scope) && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => reset("requests")}
              >
                Clear
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
            rowKey={(r) => r.id}
            onRowClick={(r) => nav(`/requests/${r.id}`)}
            page={f.page}
            pageSize={f.pageSize}
            total={list.data?.total ?? 0}
            onPage={(p) => set("requests", { page: p })}
            onPageSize={(n) => set("requests", { pageSize: n })}
            empty={
              <Empty
                title="No requests found"
                action={
                  <Button asChild>
                    <Link to="/requests/new">
                      <Plus />
                      Raise a request
                    </Link>
                  </Button>
                }
              >
                Try clearing the filters, or raise a new request.
              </Empty>
            }
          />
        )}
      </Card2>
    </>
  );
}
