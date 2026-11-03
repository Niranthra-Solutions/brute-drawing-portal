import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Check,
  Info,
  Layers,
  Plus,
  Search as SearchIcon,
  TriangleAlert,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SearchResult } from "@/lib/types";
import { dim } from "@/lib/schemas";
import { vehicleFromModel, useBootstrap, emptyVehicle } from "@/lib/hooks";
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
  ErrorState,
  Loading,
  PageHeader,
  Pill,
  SectionCard,
  Spinner,
} from "@/components/app/common";
import { FInput, FSelect } from "@/components/app/fields";
import { VehicleFields } from "@/components/app/vehicle-fields";
import {
  DrawingActions,
  DrawingComment,
  DrawingNo,
  Dims,
  VehicleCell,
  signed,
} from "@/components/app/drawing-bits";

const schema = z.object({
  // The vehicle is optional: a search needs only Voltage, Ah rating and the tray dimensions.
  vehicle: z.object({
    categoryId: z.string(),
    makeId: z.string(),
    typeId: z.string(),
    modelName: z.string(),
    capacity: z.string(),
  }),
  volt: z.string().min(1, "Select a voltage."),
  ahId: z.string().min(1, "Select an Ah rating."),
  l: dim("Length"),
  w: dim("Width"),
  h: dim("Height"),
});
type Values = z.infer<typeof schema>;

export default function SearchPage() {
  const { data: b } = useBootstrap();
  const [sp, setSp] = useSearchParams();
  const [modelId, setModelId] = useState<string>();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      vehicle: emptyVehicle,
      volt: sp.get("v") ?? "",
      ahId: sp.get("ah") ?? "",
      l: sp.get("l") ?? "",
      w: sp.get("w") ?? "",
      h: sp.get("h") ?? "",
    },
  });
  const hydrated = useRef(false);
  // The URL is the source of truth, so a refresh / shared link / browser Back restores the same search.
  useEffect(() => {
    const m = sp.get("model");
    if (b && m && !hydrated.current) {
      hydrated.current = true;
      form.setValue("vehicle", vehicleFromModel(b, m));
    }
  }, [b, sp, form]);

  const active = useMemo(() => {
    const a = b?.ahRatings.find((x) => x.id === sp.get("ah"));
    if (!a || !sp.get("v") || !sp.get("l") || !sp.get("w") || !sp.get("h"))
      return null;
    return {
      modelId: sp.get("model") ?? undefined,
      voltageV: sp.get("v"),
      ahValue: a.value,
      ahStandard: a.standard,
      lengthMm: sp.get("l"),
      widthMm: sp.get("w"),
      heightMm: sp.get("h"),
      includeSimilar: sp.get("sim") === "1",
    };
  }, [sp, b]);
  const result = useQuery({
    queryKey: ["search", active],
    queryFn: () => api.get<SearchResult>("/api/drawings/search", active!),
    enabled: !!active,
  });

  // Voltage and Ah depend on the chosen vehicle: voltage -> only those linked to the vehicle; Ah -> OEM specified first, then every other rating.
  const model = useMemo(
    () => b?.models.find((m) => m.id === modelId),
    [b, modelId],
  );
  const volt = form.watch("volt");
  // Changing from one vehicle to another (or clearing it) restarts voltage / Ah; choosing a vehicle for the first time keeps them.
  const prevModel = useRef<string | undefined>(undefined);
  useEffect(() => {
    const was = prevModel.current;
    prevModel.current = modelId;
    if (was && was !== modelId) {
      form.setValue("volt", "");
      form.setValue("ahId", "");
    }
  }, [modelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const voltOptions = useMemo(() => {
    if (!b) return [];
    // no vehicle selected -> every voltage; a vehicle -> only the voltages linked to it
    const linked = model
      ? [...new Set(model.specs.map((s) => s.voltageV))]
      : [];
    const list =
      linked.length > 0
        ? b.voltages.filter((v) => linked.includes(v.valueV))
        : b.voltages;
    return list.map((v) => ({
      value: String(v.valueV),
      label: `${v.valueV} V`,
    }));
  }, [model, b]);
  const ahOptions = useMemo(() => {
    if (!b || !volt) return [];
    // with a vehicle: OEM specified first, then the non-standard ratings; without one: every rating as non-standard
    const oem = new Set(
      (model?.specs ?? [])
        .filter((s) => String(s.voltageV) === volt && s.ahRatingId)
        .map((s) => s.ahRatingId as string),
    );
    const rank = (s: string) => (s === "DIN" ? 0 : s === "BS" ? 1 : 2);
    const others = b.ahRatings
      .filter((a) => !oem.has(a.id))
      .sort((x, y) => rank(x.standard) - rank(y.standard) || x.value - y.value);
    return [
      ...b.ahRatings
        .filter((a) => oem.has(a.id))
        .sort((x, y) => x.value - y.value)
        .map((a) => ({ value: a.id, label: a.label, group: "OEM Specified" })),
      ...others.map((a) => ({
        value: a.id,
        label: a.label,
        group: "Non-Standard Ratings",
      })),
    ];
  }, [model, b, volt]);

  const submit = form.handleSubmit((v) => {
    setSp({
      ...(modelId ? { model: modelId } : {}),
      v: v.volt,
      ah: v.ahId,
      l: v.l,
      w: v.w,
      h: v.h,
    });
  });
  const reset = () => {
    form.reset({
      vehicle: emptyVehicle,
      volt: "",
      ahId: "",
      l: "",
      w: "",
      h: "",
    });
    setSp({});
  };
  const toggleSimilar = () => {
    const n = new URLSearchParams(sp);
    if (n.get("sim") === "1") n.delete("sim");
    else n.set("sim", "1");
    setSp(n);
  };
  const r = result.data;

  return (
    <>
      <PageHeader
        eyebrow="Drawing search"
        title="Find the right drawing"
        sub="Enter the vehicle, battery and tray dimensions. You get the exact standard drawing — or, if none exists, the closest alternatives within tolerance."
      />
      <Form {...form}>
        <form onSubmit={submit} noValidate>
          <SectionCard icon={SearchIcon} title="Vehicle & battery">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <VehicleFields onResolved={setModelId} optional />
              <FSelect
                control={form.control}
                name="volt"
                label="Voltage (V)"
                required
                placeholder="Select voltage"
                options={voltOptions}
                onValueChange={() => form.setValue("ahId", "")}
              />
              <FSelect
                control={form.control}
                name="ahId"
                label="Ah rating"
                required
                disabled={!volt}
                placeholder={volt ? "Select Ah" : "Select voltage first"}
                options={ahOptions}
              />
            </div>
            <div className="mt-6 mb-4 flex items-center gap-2 border-b pb-3 text-[13px] font-extrabold">
              <Layers className="size-4 text-brand-dark" />
              Tray dimensions (mm)
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FInput
                control={form.control}
                name="l"
                label="Length (L)"
                required
                numeric
                mono
                maxLength={4}
                placeholder="Enter Length in mm"
                hint="3 or 4 digits"
              />
              <FInput
                control={form.control}
                name="w"
                label="Width (W)"
                required
                numeric
                mono
                maxLength={4}
                placeholder="Enter Width in mm"
                hint="3 or 4 digits"
              />
              <FInput
                control={form.control}
                name="h"
                label="Height (H)"
                required
                numeric
                mono
                maxLength={4}
                placeholder="Enter Height in mm"
                hint="3 or 4 digits"
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <Button
                type="submit"
                size="lg"
                className="h-9"
                disabled={result.isFetching}
              >
                {result.isFetching ? <Spinner /> : <SearchIcon />}Search
                drawings
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-9"
                onClick={reset}
              >
                Clear
              </Button>
              {b && (
                <span className="ml-auto text-xs text-muted-foreground">
                  Closest-fit tolerance: ±{b.tolerance.lengthMm} / ±
                  {b.tolerance.widthMm} / ±{b.tolerance.heightMm} mm (L / W / H)
                </span>
              )}
            </div>
          </SectionCard>
        </form>
      </Form>

      {active && result.isLoading && <Loading label="Searching…" />}
      {result.error && (
        <ErrorState error={result.error} onRetry={() => result.refetch()} />
      )}
      {r && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {r.mode === "Standard" && (
            <Advisory tone="green" icon={Check} title="Standard drawing found">
              All inputs — including the Ah rating and dimensions — match the
              drawing below.
            </Advisory>
          )}
          {r.mode === "NonStandard" && (
            <Advisory
              icon={Info}
              title="No exact match — non-standard suggestions"
            >
              {r.note}
            </Advisory>
          )}
          {r.mode === "None" && (
            <Advisory tone="blue" icon={TriangleAlert} title="No close match">
              {r.note}
            </Advisory>
          )}

          {r.exact.length > 0 && (
            <Card2 className="mb-6 overflow-x-auto">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2 text-[15px] font-extrabold">
                  Standard drawing
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {r.exact.length}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={toggleSimilar}>
                  {r.similar.length === 0
                    ? "Also show similar drawings"
                    : "Hide similar drawings"}
                </Button>
              </div>
              <Table>
                <TableHeader className="bg-panel">
                  <TableRow className="hover:bg-transparent">
                    {[
                      "ID",
                      "Drawing no.",
                      "Vehicle",
                      "Ah",
                      "V",
                      "Connector",
                      "L × W × H (mm)",
                      "Comments",
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
                  {r.exact.map((d) => (
                    <TableRow
                      key={d.id}
                      className="border-l-4 border-l-emerald-500 bg-emerald-50/40 hover:bg-emerald-50"
                    >
                      <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                        {d.serial}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <DrawingNo>{d.drawingNumber}</DrawingNo>{" "}
                        <Pill tone="green" dot={false}>
                          Rev {d.revisionLabel}
                        </Pill>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <VehicleCell d={d} />
                      </TableCell>
                      <TableCell className="px-4">{d.ah}</TableCell>
                      <TableCell className="px-4">{d.voltageV}</TableCell>
                      <TableCell className="px-4">{d.connector}</TableCell>
                      <TableCell className="px-4">
                        <Dims d={d} />
                      </TableCell>
                      <TableCell className="px-4">
                        <DrawingComment d={d} />
                      </TableCell>
                      <TableCell className="px-4">
                        <DrawingActions d={d} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card2>
          )}

          {r.similar.length > 0 && (
            <Card2 className="overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
                <div className="flex items-center gap-2 text-[15px] font-extrabold">
                  Similar drawings
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {r.similar.length}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Closest first · all Ah ratings for {active?.voltageV} V within
                  tolerance
                </span>
              </div>
              <Table>
                <TableHeader className="bg-panel">
                  <TableRow className="hover:bg-transparent">
                    {[
                      "ID",
                      "Drawing no.",
                      "Vehicle",
                      "Ah",
                      "Connector",
                      "L × W × H (mm)",
                      "Δ vs your input (mm)",
                      "Comments",
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
                  {r.similar.map((s, i) => (
                    <motion.tr
                      key={s.drawing.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-l-4 transition-colors hover:bg-muted/50 ${closeness(s)}`}
                    >
                      <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                        {s.drawing.serial}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <DrawingNo>{s.drawing.drawingNumber}</DrawingNo>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <VehicleCell d={s.drawing} />
                        {s.sameModel && (
                          <Pill tone="green" dot={false}>
                            same model
                          </Pill>
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        {s.drawing.ah}{" "}
                        {s.sameAh && (
                          <Pill tone="green" dot={false}>
                            same Ah
                          </Pill>
                        )}
                      </TableCell>
                      <TableCell className="px-4">
                        {s.drawing.connector}
                      </TableCell>
                      <TableCell className="px-4">
                        <Dims d={s.drawing} />
                      </TableCell>
                      <TableCell className="px-4 font-mono text-xs">
                        L {signed(s.deltaLength)} · W {signed(s.deltaWidth)} · H{" "}
                        {signed(s.deltaHeight)}
                      </TableCell>
                      <TableCell className="px-4">
                        <DrawingComment d={s.drawing} />
                      </TableCell>
                      <TableCell className="px-4">
                        <DrawingActions d={s.drawing} />
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </Card2>
          )}

          <Card2 className="mt-6 flex flex-wrap items-center gap-3 p-5">
            <div className="min-w-60 flex-1">
              <div className="font-bold">Not what you need?</div>
              <div className="text-muted-foreground">
                Ask Application Engineering to create a new drawing for this
                vehicle.
              </div>
            </div>
            <Button asChild>
              <Link
                to={`/requests/new?${modelId ? `model=${modelId}&` : ""}v=${active?.voltageV ?? ""}&l=${active?.lengthMm ?? ""}&w=${active?.widthMm ?? ""}&h=${active?.heightMm ?? ""}`}
              >
                <Plus />
                Request new drawing
              </Link>
            </Button>
          </Card2>
        </motion.div>
      )}
    </>
  );
}

/** Colour band for a similar drawing: green = same size (only the Ah differs), amber = a little off, orange = near the tolerance edge. */
function closeness(s: {
  deltaLength: number;
  deltaWidth: number;
  deltaHeight: number;
  sameAh: boolean;
}) {
  const worst = Math.max(
    Math.abs(s.deltaLength),
    Math.abs(s.deltaWidth),
    Math.abs(s.deltaHeight),
  );
  if (worst === 0) return "border-l-emerald-500 bg-emerald-50/40";
  if (worst <= 5) return "border-l-amber-400 bg-amber-50/40";
  return "border-l-orange-500 bg-orange-50/40";
}