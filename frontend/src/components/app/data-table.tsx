import { useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface Props<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  empty?: React.ReactNode;
  sort?: string;
  dir?: "asc" | "desc";
  onSort?: (field: string) => void;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
}

function SortIcon({ active, dir }: { active: boolean; dir?: string }) {
  if (!active) return <ChevronsUpDown className="size-3 opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

/** TanStack Table with SERVER-side sorting and pagination (the API does the work; the table only renders one page). */
export function DataTable<T>({
  columns,
  data,
  loading,
  empty,
  sort,
  dir,
  onSort,
  onRowClick,
  rowKey,
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: Props<T> & {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize?: (n: number) => void;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    getRowId: rowKey ? (r) => rowKey(r) : undefined,
  });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1,
    to = Math.min(total, page * pageSize);
  const nums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++)
    nums.push(p);
  const cols = columns.length;
  return (
    <div>
      <Table>
        <TableHeader className="bg-panel">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const s = h.column.columnDef.meta?.sort;
                return (
                  <TableHead
                    key={h.id}
                    aria-sort={
                      s && sort === s
                        ? dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      "h-10 px-4 text-[10.5px] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase",
                      h.column.columnDef.meta?.className,
                    )}
                  >
                    {h.isPlaceholder ? null : s && onSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={() => onSort(s)}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        <SortIcon active={sort === s} dir={dir} />
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 7 }, (_, r) => (
                <TableRow key={r}>
                  {Array.from({ length: cols }, (_, c) => (
                    <TableCell key={c} className="px-4 py-3.5">
                      <Skeleton
                        className="h-3.5"
                        style={{ width: `${50 + ((r + c) % 4) * 12}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && "cursor-pointer")}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(e) => {
                    if (onRowClick && e.key === "Enter")
                      onRowClick(row.original);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-4 py-3 text-[13.5px]",
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!loading && data.length === 0 && empty}
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-3 text-xs text-muted-foreground">
          <span>
            Showing {from}–{to} of {total.toLocaleString()}
          </span>
          <div className="flex items-center gap-3">
            {onPageSize && (
              <Select
                value={String(pageSize)}
                onValueChange={(v) => onPageSize(Number(v))}
              >
                <SelectTrigger
                  size="sm"
                  className="w-24"
                  aria-label="Rows per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 25, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {pages > 1 && (
              <nav className="flex items-center gap-1" aria-label="Pagination">
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page <= 1}
                  onClick={() => onPage(page - 1)}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </Button>
                {nums[0] > 1 && (
                  <>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onPage(1)}
                    >
                      1
                    </Button>
                    {nums[0] > 2 && <span>…</span>}
                  </>
                )}
                {nums.map((n) => (
                  <Button
                    key={n}
                    variant={n === page ? "default" : "outline"}
                    size="icon-sm"
                    aria-current={n === page ? "page" : undefined}
                    onClick={() => onPage(n)}
                  >
                    {n}
                  </Button>
                ))}
                {nums[nums.length - 1] < pages && (
                  <>
                    {nums[nums.length - 1] < pages - 1 && <span>…</span>}
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => onPage(pages)}
                    >
                      {pages}
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  size="icon-sm"
                  disabled={page >= pages}
                  onClick={() => onPage(page + 1)}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </Button>
              </nav>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Windowed table for long client-side lists (thousands of master-data models, bulk-import errors): only visible rows are in the DOM. */
export function VirtualTable<T>({
  columns,
  data,
  height = 420,
  rowHeight = 46,
}: {
  columns: ColumnDef<T>[];
  data: T[];
  height?: number;
  rowHeight?: number;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  const rows = table.getRowModel().rows;
  const ref = useRef<HTMLDivElement>(null);
  const v = useVirtualizer({
    count: rows.length,
    getScrollElement: () => ref.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });
  const items = v.getVirtualItems();
  const padTop = items[0]?.start ?? 0,
    padBottom = v.getTotalSize() - (items[items.length - 1]?.end ?? 0);
  const cols = columns.length;
  return (
    <div
      ref={ref}
      style={{ maxHeight: height }}
      className="overflow-auto"
      data-testid="virtual-table"
    >
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-panel">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b">
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className={cn(
                    "h-10 px-4 text-left text-[10.5px] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase",
                    h.column.columnDef.meta?.className,
                  )}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr>
              <td style={{ height: padTop }} colSpan={cols} />
            </tr>
          )}
          {items.map((vi) => {
            const row = rows[vi.index];
            return (
              <tr
                key={row.id}
                style={{ height: rowHeight }}
                className="border-b hover:bg-muted/40"
              >
                {row.getVisibleCells().map((c) => (
                  <td
                    key={c.id}
                    className={cn(
                      "px-4 text-[13.5px]",
                      c.column.columnDef.meta?.className,
                    )}
                  >
                    {flexRender(c.column.columnDef.cell, c.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {padBottom > 0 && (
            <tr>
              <td style={{ height: padBottom }} colSpan={cols} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
