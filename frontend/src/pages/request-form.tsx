import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Layers, Pencil, Send, UploadCloud } from "lucide-react";
import { api } from "@/lib/api";
import type {
  Drawing,
  DrawingDetail,
  RequestDetail,
  UploadedFile,
} from "@/lib/types";
import { formatByMask, isValidNumber, maskHint } from "@/lib/util";
import { optionalDim, dim } from "@/lib/schemas";
import { useBootstrap } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Advisory,
  FormError,
  PageHeader,
  Pill,
  SectionCard,
  Spinner,
  applyServerErrors,
  notify,
} from "@/components/app/common";
import { FInput, FSelect, FTextarea } from "@/components/app/fields";
import { FileUpload } from "@/components/app/file-upload";
import { Dims } from "@/components/app/drawing-bits";

const CHANGE_TYPES = ["Dimensional", "End connector", "Other"];
const makeSchema = (mode: "New" | "Modification") =>
  z
    .object({
      category: z.string(),
      type: z.string(),
      make: z.string(),
      model: z.string(),
      capacity: z.string(),
      volt: z.string(),
      ahId: z.string(),
      connector: z.string(),
      l: z.string(),
      w: z.string(),
      h: z.string(),
      priority: z.string(),
      changeType: z.string(),
      targetDate: z.string(),
      description: z.string(),
      reason: z.string(),
      drawingId: z.string(),
      attachments: z.array(z.string()),
    })
    .superRefine((v, ctx) => {
      const need = (k: keyof typeof v, msg: string) => {
        if (!String(v[k]).trim())
          ctx.addIssue({ code: "custom", path: [k], message: msg });
      };
      const dims = mode === "New" ? dim : optionalDim;
      for (const [k, l] of [
        ["l", "Length"],
        ["w", "Width"],
        ["h", "Height"],
      ] as const) {
        const r = dims(l).safeParse(v[k]);
        if (!r.success)
          ctx.addIssue({
            code: "custom",
            path: [k],
            message: r.error.issues[0].message,
          });
      }
      if (mode === "New") {
        need("category", "Select the vehicle category.");
        need("type", "Select the vehicle type.");
        need("make", "Enter the vehicle make.");
        need("model", "Enter the model.");
        need("capacity", "Enter the capacity.");
        need("volt", "Select the voltage.");
        need("ahId", "Select the Ah rating.");
        need("connector", "Select the end connector.");
      } else {
        need("drawingId", "Choose the drawing to modify.");
      }
    });
type Values = z.infer<ReturnType<typeof makeSchema>>;

export default function RequestFormPage({
  mode,
}: {
  mode: "New" | "Modification";
}) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const [sp] = useSearchParams();
  const { data: b } = useBootstrap();
  const isMod = mode === "Modification";
  const cloneId = sp.get("clone") ?? "";
  const schema = useMemo(() => makeSchema(mode), [mode]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "",
      type: "",
      make: "",
      model: "",
      capacity: "",
      volt: "",
      ahId: "",
      connector: "",
      l: "",
      w: "",
      h: "",
      priority: "Standard",
      changeType: "",
      targetDate: "",
      description: "",
      reason: "",
      drawingId: sp.get("drawingId") ?? "",
      attachments: [],
    },
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [lookup, setLookup] = useState("");
  const [lookupErr, setLookupErr] = useState("");
  const [matches, setMatches] = useState<Drawing[]>([]);
  const [err, setErr] = useState("");
  const drawingId = form.watch("drawingId");
  const make = form.watch("make");
  const model = form.watch("model");
  const src = useQuery({
    queryKey: ["drawing", drawingId || cloneId],
    queryFn: () =>
      api.get<DrawingDetail>(`/api/drawings/${drawingId || cloneId}`),
    enabled: !!(drawingId || cloneId),
    retry: false,
  });

  // Prefill from a search result (model, v, l, w, h) or by cloning an existing drawing.
  useEffect(() => {
    if (!b || isMod) return;
    const m = b.models.find((x) => x.id === sp.get("model"));
    if (m)
      form.reset({
        ...form.getValues(),
        category: b.categories.find((c) => c.id === m.categoryId)?.name ?? "",
        type: b.vehicleTypes.find((t) => t.id === m.vehicleTypeId)?.name ?? "",
        make: b.makes.find((k) => k.id === m.makeId)?.name ?? "",
        model: m.name,
        capacity: m.capacity,
        volt: sp.get("v") ?? "",
        l: sp.get("l") ?? "",
        w: sp.get("w") ?? "",
        h: sp.get("h") ?? "",
      });
  }, [b, sp, isMod, form]);
  useEffect(() => {
    const d = src.data?.drawing;
    if (!d || isMod) return;
    form.reset({
      ...form.getValues(),
      category: d.category,
      type: d.vehicleType,
      make: d.make,
      model: d.model,
      capacity: d.capacity,
      volt: String(d.voltageV),
      ahId:
        b?.ahRatings.find(
          (a) => a.value === d.ahValue && a.standard === d.ahStandard,
        )?.id ?? "",
      l: String(d.lengthMm),
      w: String(d.widthMm),
      h: String(d.heightMm),
      connector: d.connector,
      description: `Based on existing drawing ${d.drawingNumber} — please adapt for the requirement below.\n`,
    });
  }, [src.data, b, isMod, form]);

  const modelHints = useMemo(
    () => [
      ...new Set(
        (b?.models ?? [])
          .filter(
            (m) =>
              !make ||
              b!.makes.find((k) => k.id === m.makeId)?.name.toLowerCase() ===
                make.toLowerCase(),
          )
          .map((m) => m.name),
      ),
    ],
    [b, make],
  );
  const capHints = useMemo(
    () => [
      ...new Set(
        (b?.models ?? [])
          .filter((m) => !model || m.name.toLowerCase() === model.toLowerCase())
          .map((m) => m.capacity),
      ),
    ],
    [b, model],
  );
  const mask = b?.drawingNumberMask ?? "## ### ### A";

  const findDrawing = async () => {
    setLookupErr("");
    if (!isValidNumber(lookup, mask)) {
      setLookupErr(
        `Enter the number as ${maskHint(mask)} (example ${b?.drawingNumberExample ?? ""}).`,
      );
      return;
    }
    try {
      const r = await api.get<{ items: Drawing[]; note: string | null }>(
        "/api/drawings/by-number/all",
        { number: lookup },
      );
      if (r.items.length === 1) {
        setMatches([]);
        form.setValue("drawingId", r.items[0].id, { shouldValidate: true });
      } else setMatches(r.items); // several drawings share this number: let the user choose
    } catch (e) {
      setLookupErr(e instanceof Error ? e.message : "Not found");
    }
  };
  const addFile = (f: UploadedFile) => {
    setFiles((p) => [...p, f]);
    form.setValue("attachments", [...form.getValues("attachments"), f.id], {
      shouldValidate: true,
    });
  };
  const removeFile = (id: string) => {
    setFiles((p) => p.filter((x) => x.id !== id));
    form.setValue(
      "attachments",
      form.getValues("attachments").filter((x) => x !== id),
      { shouldValidate: true },
    );
  };

  const submit = form.handleSubmit(async (v) => {
    setErr("");
    const ah = b?.ahRatings.find((a) => a.id === v.ahId);
    const n = (s: string) => (s ? Number(s) : null);
    try {
      const r = await api.post<RequestDetail>("/api/requests", {
        type: mode,
        priority: v.priority,
        relatedDrawingId: isMod ? v.drawingId : cloneId || undefined,
        categoryName: v.category,
        vehicleTypeName: v.type,
        makeName: v.make,
        modelName: v.model,
        capacity: v.capacity,
        voltageV: isMod ? null : n(v.volt),
        ahValue: isMod ? null : (ah?.value ?? null),
        ahStandard: isMod ? null : (ah?.standard ?? null),
        lengthMm: n(v.l),
        widthMm: n(v.w),
        heightMm: n(v.h),
        connectorName: v.connector,
        changeType: v.changeType,
        targetDate: v.targetDate || null,
        description: v.description,
        reason: v.reason,
        attachmentFileIds: v.attachments,
      });
      for (const k of ["requests", "request-stats", "dashboard"])
        qc.invalidateQueries({ queryKey: [k] });
      notify.ok(
        `Request ${r.ticketNo} submitted — Application Engineering has been notified`,
      );
      nav(`/requests/${r.id}`);
    } catch (e) {
      setErr(
        applyServerErrors(form, e, {
          voltageV: "volt",
          ahValue: "ahId",
          lengthMm: "l",
          widthMm: "w",
          heightMm: "h",
          connectorName: "connector",
          categoryName: "category",
          vehicleTypeName: "type",
          makeName: "make",
          modelName: "model",
          relatedDrawingId: "drawingId",
          attachmentFileIds: "attachments",
        }) ?? "",
      );
    }
  });
  const d = src.data?.drawing;
  const c = form.control;
  return (
    <>
      <PageHeader
        eyebrow={isMod ? "Drawing modification request" : "New drawing request"}
        title={
          isMod ? "Request a drawing modification" : "Request a new drawing"
        }
        sub={
          isMod
            ? "Pick the existing drawing, say what must change and why. Engineering is notified immediately."
            : "Tell us about the vehicle and battery. Most fields are drop-downs, so requests arrive complete and standardised."
        }
      />
      <Form {...form}>
        <form onSubmit={submit} noValidate>
          <FormError>{err}</FormError>
          {isMod && (
            <SectionCard icon={FileText} title="Existing drawing">
              {d && drawingId ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-mono text-[15px] font-semibold text-brand-dark">
                    {d.drawingNumber}
                  </span>
                  <span>
                    {d.make} {d.model} · {d.capacity}
                  </span>
                  <span className="text-muted-foreground">
                    {d.voltageV} V · {d.ah} Ah · <Dims d={d} />
                  </span>
                  <Pill tone="green" dot={false}>
                    Rev {d.revisionLabel}
                  </Pill>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => form.setValue("drawingId", "")}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="lookup" className="text-xs font-bold">
                    Drawing number <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id="lookup"
                      className="h-9 max-w-[280px] font-mono"
                      value={lookup}
                      placeholder={b?.drawingNumberExample}
                      onChange={(e) =>
                        setLookup(
                          formatByMask(
                            e.target.value,
                            mask,
                            e.target.value.length < lookup.length,
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={findDrawing}
                    >
                      Find drawing
                    </Button>
                    <Button asChild variant="ghost">
                      <Link to="/search">Search by dimensions instead</Link>
                    </Button>
                  </div>
                  {(lookupErr || form.formState.errors.drawingId) && (
                    <p
                      role="alert"
                      className="text-xs font-semibold text-destructive"
                    >
                      {lookupErr || form.formState.errors.drawingId?.message}
                    </p>
                  )}
                  {matches.length > 1 && (
                    <div className="mt-3">
                      <div className="mb-2 text-[13px] font-bold">
                        {matches.length} drawings use this number - select the
                        one to modify
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {matches.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() =>
                              form.setValue("drawingId", m.id, {
                                shouldValidate: true,
                              })
                            }
                            className="rounded-xl border bg-background px-3.5 py-3 text-left transition hover:border-brand hover:bg-brand-soft/40"
                          >
                            <div className="font-mono text-[13px] font-bold text-brand-dark">
                              {m.drawingNumber}
                            </div>
                            <div className="text-[13px] font-semibold">
                              {m.make} {m.model}{" "}
                              <span className="font-normal text-muted-foreground">
                                · {m.capacity}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {m.category} · {m.vehicleType} · {m.ah} ·{" "}
                              {m.voltageV} V · {m.lengthMm}×{m.widthMm}×
                              {m.heightMm} · Rev {m.revisionLabel}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          )}
          {!isMod && cloneId && d && (
            <Advisory tone="blue" title={`Based on ${d.drawingNumber}`}>
              Details were pre-filled from this existing drawing. Adjust
              whatever differs.
            </Advisory>
          )}
          <SectionCard
            icon={Layers}
            title={
              isMod
                ? "Required changes (leave unchanged fields blank)"
                : "Vehicle & battery"
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {!isMod && (
                <>
                  <FSelect
                    control={c}
                    name="category"
                    label="Vehicle category"
                    required
                    placeholder="Select category"
                    options={(b?.categories ?? []).map((x) => ({
                      value: x.name,
                      label: x.name,
                    }))}
                  />
                  <FInput
                    control={c}
                    name="make"
                    label="Vehicle make"
                    required
                    list="make-list"
                    placeholder="Type or pick a make"
                  />
                  <datalist id="make-list">
                    {b?.makes.map((m) => (
                      <option key={m.id} value={m.name} />
                    ))}
                  </datalist>
                  <FSelect
                    control={c}
                    name="type"
                    label="Vehicle type"
                    required
                    placeholder="Select type"
                    options={(b?.vehicleTypes ?? []).map((x) => ({
                      value: x.name,
                      label: x.name,
                    }))}
                  />
                  <FInput
                    control={c}
                    name="model"
                    label="Model no."
                    required
                    list="model-list"
                  />
                  <datalist id="model-list">
                    {modelHints.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                  <FInput
                    control={c}
                    name="capacity"
                    label="Vehicle capacity"
                    required
                    list="cap-list"
                    placeholder="e.g. 1.8 T"
                  />
                  <datalist id="cap-list">
                    {capHints.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </>
              )}
              {isMod && (
                <FSelect
                  control={c}
                  name="changeType"
                  label="Type of change"
                  placeholder="Select"
                  options={CHANGE_TYPES.map((x) => ({ value: x, label: x }))}
                />
              )}
              {!isMod && (
                <>
                  <FSelect
                    control={c}
                    name="volt"
                    label="Voltage (V)"
                    required
                    placeholder="Select voltage"
                    options={(b?.voltages ?? []).map((v) => ({
                      value: String(v.valueV),
                      label: `${v.valueV} V`,
                    }))}
                  />
                  <FSelect
                    control={c}
                    name="ahId"
                    label="Ah rating"
                    required
                    placeholder="Select Ah"
                    options={(b?.ahRatings ?? []).map((a) => ({
                      value: a.id,
                      label: a.label,
                    }))}
                  />
                </>
              )}
              <FInput
                control={c}
                name="connector"
                label="End connector type"
                required={!isMod}
                list="connector-list"
                placeholder={
                  isMod
                    ? "No change - pick or type a connector"
                    : "Pick from the list or type your own"
                }
                hint="Choose a standard connector from the list, or type any other one."
                maxLength={100}
              />
              <datalist id="connector-list">
                {b?.connectors.map((x) => (
                  <option key={x.id} value={x.name} />
                ))}
              </datalist>
            </div>
            <div className="mt-6 mb-3 text-xs font-bold">
              Tray dimensions (mm)
              {!isMod && <span className="text-destructive"> *</span>}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <FInput
                control={c}
                name="l"
                label="Length (L)"
                numeric
                mono
                maxLength={4}
                placeholder="3–4 digits"
              />
              <FInput
                control={c}
                name="w"
                label="Width (W)"
                numeric
                mono
                maxLength={4}
                placeholder="3–4 digits"
              />
              <FInput
                control={c}
                name="h"
                label="Height (H)"
                numeric
                mono
                maxLength={4}
                placeholder="3–4 digits"
              />
            </div>
          </SectionCard>
          <SectionCard icon={Pencil} title="Details">
            <div className="mb-4 grid gap-4 md:grid-cols-2">
              <FSelect
                control={c}
                name="priority"
                label="Priority"
                options={["Standard", "High", "Critical"].map((x) => ({
                  value: x,
                  label: x,
                }))}
              />
              {isMod && (
                <FInput
                  control={c}
                  name="targetDate"
                  label="Needed by (optional)"
                  type="date"
                />
              )}
            </div>
            <FTextarea
              control={c}
              name="description"
              label={
                isMod ? "Required change" : "Additional requirement comments"
              }
              maxLength={4000}
            />
            {isMod && (
              <div className="mt-4">
                <FTextarea
                  control={c}
                  name="reason"
                  label="Reason for modification"
                  maxLength={2000}
                />
              </div>
            )}
          </SectionCard>
          <SectionCard
            icon={UploadCloud}
            title="Design reference image, drawing or video"
          >
            {files.map((x) => (
              <div key={x.id} className="mb-3 flex items-center gap-2">
                <FileText className="size-4" />
                <span className="font-bold">{x.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFile(x.id)}
                >
                  Remove
                </Button>
              </div>
            ))}
            {files.length < 5 && (
              <FileUpload
                key={files.length}
                endpoint="/api/files/attachments"
                accept=".jpg,.jpeg,.png,.pdf,.dwg,.mp4,.mov,.m4v,.webm"
                hint="Image, PDF, DWG (up to 10 MB) or video mp4 / mov / webm (up to 200 MB) · max 5 files"
                compact
                onUploaded={addFile}
              />
            )}
            {form.formState.errors.attachments && (
              <p
                role="alert"
                className="mt-1.5 text-xs font-semibold text-destructive"
              >
                {form.formState.errors.attachments.message as string}
              </p>
            )}
          </SectionCard>
          <div className="flex justify-end gap-2.5">
            <Button asChild variant="outline">
              <Link to="/requests">Cancel</Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : <Send />}Submit
              request
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
