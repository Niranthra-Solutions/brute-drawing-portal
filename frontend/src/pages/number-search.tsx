import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Info, Plus, Search, SearchX, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Drawing } from "@/lib/types";
import { formatByMask, isValidNumber, maskHint } from "@/lib/util";
import { drawingNumber } from "@/lib/schemas";
import { useBootstrap } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Advisory,
  Card2,
  Empty,
  Loading,
  PageHeader,
  Pill,
  Spinner,
} from "@/components/app/common";
import { FInput } from "@/components/app/fields";
import { DrawingActions, DrawingNo, Dims } from "@/components/app/drawing-bits";

export default function NumberSearchPage() {
  const { data: b } = useBootstrap();
  const [sp, setSp] = useSearchParams();
  const mask = b?.drawingNumberMask ?? "## ### ### A";
  const example = b?.drawingNumberExample ?? "25 600 001 A";
  const schema = useMemo(
    () => z.object({ number: drawingNumber(mask, example) }),
    [mask, example],
  );
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { number: sp.get("number") ?? "" },
    mode: "onSubmit",
  });
  const number = sp.get("number");
  const valid = !!number && isValidNumber(number, mask);
  const q = useQuery({
    queryKey: ["by-number", number],
    queryFn: () =>
      api.get<{ items: Drawing[]; note: string | null }>(
        "/api/drawings/by-number/all",
        { number },
      ),
    enabled: valid,
    retry: false,
  });
  const apiErr = q.error instanceof ApiError ? q.error : null;
  const items = q.data?.items ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Search by drawing number"
        title="Go straight to a drawing"
        sub="Enter the drawing number exactly as printed. Spaces are added for you."
      />
      <Card2 className="mb-6 p-5">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((v) =>
              setSp({ number: v.number.trim().toUpperCase() }),
            )}
            noValidate
            className="flex flex-wrap items-start gap-3"
          >
            <FInput
              control={form.control}
              name="number"
              label="Drawing number"
              required
              mono
              autoFocus
              className="w-full max-w-xs"
              placeholder={example}
              hint={`Format ${maskHint(mask)} — example ${example}`}
              transform={(v, prev) =>
                formatByMask(v, mask, v.length < prev.length)
              }
            />
            <Button
              type="submit"
              size="lg"
              className="mt-[22px] h-9"
              disabled={q.isFetching}
            >
              {q.isFetching ? <Spinner /> : <Search />}Search
            </Button>
          </form>
        </Form>
      </Card2>
      {number && !valid && (
        <Advisory icon={TriangleAlert} title="Invalid format">
          "{number}" is not a valid drawing number. Use the format{" "}
          {maskHint(mask)} — for example {example}.
        </Advisory>
      )}
      {valid && q.isLoading && <Loading label="Looking up…" />}
      {apiErr?.status === 404 && (
        <Card2>
          <Empty
            icon={SearchX}
            title="No drawing found"
            action={
              <Button asChild>
                <Link to="/requests/new">
                  <Plus />
                  Request a new drawing
                </Link>
              </Button>
            }
          >
            {apiErr.message}
          </Empty>
        </Card2>
      )}
      {apiErr && apiErr.status !== 404 && (
        <Advisory icon={TriangleAlert} title="Could not search">
          {apiErr.message}
        </Advisory>
      )}
      {items.length > 0 && (
        <>
          {q.data?.note && (
            <Advisory
              tone="blue"
              icon={Info}
              title={
                items.length > 1
                  ? "Several drawings share this number"
                  : "Superseded number"
              }
            >
              {q.data.note}
            </Advisory>
          )}
          <Card2 className="overflow-hidden">
            <div className="border-b px-5 py-4 text-[15px] font-extrabold">
              {items.length > 1 ? `Results (${items.length})` : "Result"}
            </div>
            <Table>
              <TableHeader className="bg-panel">
                <TableRow className="hover:bg-transparent">
                  {[
                    "Drawing no.",
                    "Vehicle",
                    "Ah",
                    "V",
                    "Connector",
                    "L × W × H (mm)",
                    "Revision",
                    "",
                  ].map((h) => (
                    <TableHead
                      key={h}
                      className="h-10 px-4 text-[10.5px] font-bold tracking-wider whitespace-nowrap text-muted-foreground uppercase"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="px-4 py-3">
                      <DrawingNo>{d.drawingNumber}</DrawingNo>
                    </TableCell>
                    <TableCell className="px-4">
                      {d.make} {d.model}
                      <div className="text-xs text-muted-foreground">
                        {d.category} · {d.vehicleType} · {d.capacity}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">{d.ah}</TableCell>
                    <TableCell className="px-4">{d.voltageV}</TableCell>
                    <TableCell className="px-4">{d.connector}</TableCell>
                    <TableCell className="px-4">
                      <Dims d={d} />
                    </TableCell>
                    <TableCell className="px-4">
                      <Pill tone="green" dot={false}>
                        Rev {d.revisionLabel}
                      </Pill>
                    </TableCell>
                    <TableCell className="px-4">
                      <DrawingActions d={d} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card2>
        </>
      )}
    </>
  );
}
