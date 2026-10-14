import { useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Database,
  ExternalLink,
  Info,
  Layers,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  Bootstrap,
  Drawing,
  DrawingDetail,
  Paged,
  ModelItem,
  NamedItem,
  RequestDetail,
  UploadedFile,
} from "@/lib/types";
import { formatByMask, maskHint } from "@/lib/util";
import { dim, drawingNumber } from "@/lib/schemas";
import {
  useBootstrap,
  vehicleFromModel,
  emptyVehicle,
  type VehicleSel,
} from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Advisory,
  FormError,
  Loading,
  PageHeader,
  SectionCard,
  Spinner,
  applyServerErrors,
  notify,
} from "@/components/app/common";
import { FInput, FSelect, FTextarea } from "@/components/app/fields";
import { FileUpload } from "@/components/app/file-upload";
import { VehicleFields } from "@/components/app/vehicle-fields";

type Mode = "new" | "edit" | "revision";
interface PendingVehicle {
  category: string;
  make: string;
  type: string;
  model: string;
  capacity: string;
}
interface Values {
  vehicle: typeof emptyVehicle;
  number: string;
  volt: string;
  ahId: string;
  l: string;
  w: string;
  h: string;
  connector: string;
  comments: string;
  competitor: string;
  notes: string;
  status: string;
  fileId: string;
}
/** 25 600 028 A -> 25 600 028 B (next free letter across all existing revisions of this vehicle drawing). */
function nextRevisionNumber(
  current: string,
  lineage?: { drawingNumber: string }[] | null,
) {
  if (!/ [A-Z]$/.test(current)) return "";
  const last = [current, ...(lineage ?? []).map((x) => x.drawingNumber)]
    .map((n) => n.slice(-1))
    .sort()
    .pop()!;
  return last >= "Z"
    ? ""
    : current.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
}
const empty: Values = {
  vehicle: emptyVehicle,
  number: "",
  volt: "",
  ahId: "",
  l: "",
  w: "",
  h: "",
  connector: "",
  comments: "",
  competitor: "",
  notes: "",
  status: "Active",
  fileId: "",
};

/** Live list of what is already saved for the typed drawing number and for the chosen vehicle, so nothing is uploaded blind. */
function ExistingDrawings({
  number,
  modelId,
  fileId,
  ignoreId,
  complete,
}: {
  number: string;
  modelId: string;
  fileId: string;
  ignoreId?: string;
  complete: boolean;
}) {
  const byNumber = useQuery({
    queryKey: ["drawings", "num", number],
    queryFn: () =>
      api.get<Paged<Drawing>>("/api/drawings", {
        number,
        pageSize: 50,
        sort: "make",
        dir: "asc",
      }),
    enabled: complete,
  });
  const byVehicle = useQuery({
    queryKey: ["drawings", "veh", modelId],
    queryFn: () =>
      api.get<Paged<Drawing>>("/api/drawings", {
        modelId,
        pageSize: 50,
        sort: "number",
        dir: "asc",
      }),
    enabled: !!modelId,
  });
  const byFile = useQuery({
    queryKey: ["drawings", "file", fileId],
    queryFn: () =>
      api.get<Paged<Drawing>>("/api/drawings", {
        fileId,
        pageSize: 50,
        sort: "number",
        dir: "asc",
      }),
    enabled: !!fileId,
  });
  const fil = (fileId ? (byFile.data?.items ?? []) : []).filter(
    (d) => d.id !== ignoreId,
  );
  const num = (complete ? (byNumber.data?.items ?? []) : []).filter(
    (d) => d.id !== ignoreId,
  );
  const veh = (modelId ? (byVehicle.data?.items ?? []) : []).filter(
    (d) => d.id !== ignoreId,
  );
  const Row = ({ d }: { d: Drawing }) => (
    <Link
      to={`/drawings/${d.id}`}
      target="_blank"
      className="group flex items-start gap-3 rounded-xl border bg-background px-3 py-2.5 hover:border-brand/50 hover:bg-brand-soft/40"
    >
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[13px] font-bold text-brand-dark">
          {d.drawingNumber}
        </div>
        <div className="truncate text-[13px] font-semibold">
          {d.make} {d.model}{" "}
          <span className="font-normal text-muted-foreground">
            · {d.capacity}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {d.ah} · {d.voltageV} V · {d.lengthMm}×{d.widthMm}×{d.heightMm} · Rev{" "}
          {d.revisionLabel}
        </div>
      </div>
      <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground group-hover:text-brand-dark" />
    </Link>
  );
  const Group = ({ title, rows }: { title: string; rows: Drawing[] }) => (
    <div className="mt-4 first:mt-0">
      <div className="mb-2 text-[12px] font-bold tracking-wide text-muted-foreground uppercase">
        {title} ({rows.length})
      </div>
      <div className="grid max-h-[300px] gap-2 overflow-y-auto pr-1">
        {rows.map((d) => (
          <Row key={d.id} d={d} />
        ))}
      </div>
    </div>
  );
  return (
    <SectionCard icon={Info} title="Already in the portal">
      {!num.length && !veh.length && !fil.length ? (
        <p className="text-[13px] text-muted-foreground">
          Upload the file, pick the vehicle and type the drawing number.
          Drawings already saved with the same file, the same number, or for the
          same vehicle appear here so you can check before saving.
        </p>
      ) : (
        <>
          {fil.length > 0 && <Group title="Same drawing file" rows={fil} />}
          {num.length > 0 && (
            <Group title={`Same number ${number}`} rows={num} />
          )}
          {veh.length > 0 && <Group title="Same vehicle" rows={veh} />}
        </>
      )}
    </SectionCard>
  );
}

/** Live checklist + summary of what is being saved. */
function Summary({ items }: { items: [string, string | undefined | false][] }) {
  return (
    <SectionCard icon={Check} title="Summary">
      <dl className="grid gap-2 text-[13px]">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{k}</dt>
            <dd
              className={
                v
                  ? "text-right font-semibold [overflow-wrap:anywhere]"
                  : "text-right text-muted-foreground/60"
              }
            >
              {v || "—"}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

export default function DrawingFormPage({ mode }: { mode: Mode }) {
  const { id = "" } = useParams();
  const [sp] = useSearchParams();
  const requestId = sp.get("requestId") ?? "";
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: b } = useBootstrap();
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [pending, setPending] = useState<PendingVehicle | null>(null);
  const [adding, setAdding] = useState(false);
  const [modelId, setModelId] = useState<string>();
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const src = useQuery({
    queryKey: ["drawing", id],
    queryFn: () => api.get<DrawingDetail>(`/api/drawings/${id}`),
    enabled: mode !== "new",
  });
  const req = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => api.get<RequestDetail>(`/api/requests/${requestId}`),
    enabled: !!requestId,
  });
  const mask = b?.drawingNumberMask ?? "## ### ### A";
  const example = b?.drawingNumberExample ?? "";
  const currentNo = src.data?.drawing.drawingNumber;

  const opt = <T extends z.ZodType<string>>(t: T) =>
    mode === "revision" ? z.union([z.literal(""), t]) : t; // revision: blank = keep the earlier revision's value
  const schema = useMemo(
    () =>
      z
        .object({
          vehicle: z.object({
            categoryId: z.string(),
            makeId: z.string(),
            typeId: z.string(),
            modelName: z.string(),
            capacity: z.string(),
          }), // completeness is checked on submit (the requester's vehicle may still have to be added to master data)
          number: z.string(),
          volt: z.string().min(1, "Select a voltage."),
          ahId: z.string().min(1, "Select an Ah rating."),
          l: opt(dim("Length")),
          w: opt(dim("Width")),
          h: opt(dim("Height")),
          connector:
            mode === "revision"
              ? z.string().trim().max(100)
              : z
                  .string()
                  .trim()
                  .min(1, "Select or type the end connector.")
                  .max(100),
          comments: z.string().max(2000),
          competitor: z.string().max(60),
          notes: z.string().max(2000),
          status: z.string(),
          fileId: z.string(),
        })
        .superRefine((v, ctx) => {
          if (mode === "revision" && v.number === currentNo)
            ctx.addIssue({
              code: "custom",
              path: ["number"],
              message: `A revision is a new drawing - give it the next number, for example ${nextRevisionNumber(currentNo ?? "", src.data?.lineage) || example}.`,
            });
          else if (!drawingNumber(mask, example).safeParse(v.number).success)
            ctx.addIssue({
              code: "custom",
              path: ["number"],
              message: `Use the format ${maskHint(mask)} (example ${example}).`,
            });
          if (mode !== "edit" && !v.fileId)
            ctx.addIssue({
              code: "custom",
              path: ["fileId"],
              message: "Upload the drawing file first.",
            });
          if (mode === "revision" && v.notes.trim().length < 3)
            ctx.addIssue({
              code: "custom",
              path: ["notes"],
              message: "Describe what changed in this revision.",
            });
        }),
    [mask, example, mode, currentNo],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: empty,
  });

  // One-time prefill: from the drawing (edit / revision) and/or the request (so the admin lands on a ready-to-save form).
  useEffect(() => {
    if (
      ready ||
      !b ||
      (mode !== "new" && !src.data) ||
      (requestId && !req.data)
    )
      return;
    const d = src.data?.drawing,
      r = req.data;
    const v: Values = { ...empty };
    if (d)
      Object.assign(v, {
        vehicle: vehicleFromModel(b, d.modelId),
        number:
          mode === "revision"
            ? nextRevisionNumber(d.drawingNumber, src.data?.lineage)
            : d.drawingNumber,
        volt: String(d.voltageV),
        ahId:
          b.ahRatings.find(
            (a) => a.value === d.ahValue && a.standard === d.ahStandard,
          )?.id ?? "",
        l: String(d.lengthMm),
        w: String(d.widthMm),
        h: String(d.heightMm),
        connector: d.connector,
        comments: d.comments ?? "",
        competitor: d.competitorDrawingNumber ?? "",
        status: d.status,
      });
    if (r) {
      const find = <T extends { id: string; name: string }>(
        a: T[],
        n: string | null,
      ) => a.find((x) => x.name.toLowerCase() === (n ?? "").toLowerCase());
      if (!d) {
        const cat = find(b.categories, r.categoryName),
          make = find(b.makes, r.makeName),
          type = find(b.vehicleTypes, r.vehicleTypeName);
        const m = b.models.find(
          (x) =>
            x.name.toLowerCase() === (r.modelName ?? "").toLowerCase() &&
            x.makeId === make?.id &&
            x.vehicleTypeId === type?.id &&
            x.categoryId === cat?.id &&
            x.capacity.toLowerCase() === (r.capacity ?? "").toLowerCase(),
        );
        if (m) v.vehicle = vehicleFromModel(b, m.id);
        else {
          // not (fully) in master data yet: fill every step that does exist, and offer to add the rest from what the requester typed
          const vv = { ...emptyVehicle };
          if (cat) {
            vv.categoryId = cat.id;
            const mk =
              make &&
              b.models.some(
                (x) => x.categoryId === cat.id && x.makeId === make.id,
              )
                ? make
                : undefined;
            if (mk) {
              vv.makeId = mk.id;
              const ty =
                type &&
                b.models.some(
                  (x) =>
                    x.categoryId === cat.id &&
                    x.makeId === mk.id &&
                    x.vehicleTypeId === type.id,
                )
                  ? type
                  : undefined;
              if (ty) {
                vv.typeId = ty.id;
                const mn = b.models.find(
                  (x) =>
                    x.categoryId === cat.id &&
                    x.makeId === mk.id &&
                    x.vehicleTypeId === ty.id &&
                    x.name.toLowerCase() === (r.modelName ?? "").toLowerCase(),
                );
                if (mn) vv.modelName = mn.name;
              }
            }
          }
          v.vehicle = vv;
          if (
            r.categoryName &&
            r.makeName &&
            r.vehicleTypeName &&
            r.modelName &&
            r.capacity
          )
            setPending({
              category: r.categoryName,
              make: r.makeName,
              type: r.vehicleTypeName,
              model: r.modelName,
              capacity: r.capacity,
            });
        }
      }
      const ah = r.ah
        ? b.ahRatings.find((a) => a.label === r.ah)?.id
        : undefined;
      Object.assign(v, {
        ...(r.voltageV ? { volt: String(r.voltageV) } : {}),
        ...(ah ? { ahId: ah } : {}),
        ...(r.lengthMm ? { l: String(r.lengthMm) } : {}),
        ...(r.widthMm ? { w: String(r.widthMm) } : {}),
        ...(r.heightMm ? { h: String(r.heightMm) } : {}),
        ...(r.connectorName
          ? {
              connector:
                find(b.connectors, r.connectorName)?.name ?? r.connectorName,
            }
          : {}),
        notes: mode === "revision" ? (r.description ?? "").slice(0, 500) : "",
        comments:
          v.comments ||
          (mode === "new" ? (r.description ?? "").slice(0, 500) : ""),
      });
    }
    form.reset(v);
    setReady(true);
  }, [b, src.data, req.data, mode, requestId, ready, form]);

  if (
    !b ||
    (mode !== "new" && src.isLoading) ||
    (requestId && req.isLoading) ||
    !ready
  )
    return <Loading />;
  const title =
    mode === "new"
      ? "Upload a drawing"
      : mode === "edit"
        ? "Modify drawing"
        : "Upload revised drawing";
  const control = form.control;

  /** Adds whatever part of the requester's vehicle is missing from master data, and returns the model id. */
  const ensureVehicle = async (p: PendingVehicle) => {
    const fresh = await api.get<Bootstrap>("/api/lookups/bootstrap");
    const eq = (a: string, c: string) =>
      a.trim().toLowerCase() === c.trim().toLowerCase();
    const named = async (list: NamedItem[], kind: string, name: string) =>
      list.find((x) => eq(x.name, name)) ??
      (await api.post<NamedItem>(`/api/master/named/${kind}`, {
        name: name.trim(),
        sortOrder: 0,
        isActive: true,
      }));
    const cat = await named(fresh.categories, "categories", p.category),
      make = await named(fresh.makes, "makes", p.make),
      type = await named(fresh.vehicleTypes, "vehicle-types", p.type);
    const model =
      fresh.models.find(
        (x) =>
          eq(x.name, p.model) &&
          x.makeId === make.id &&
          x.vehicleTypeId === type.id &&
          x.categoryId === cat.id &&
          eq(x.capacity, p.capacity),
      ) ??
      (await api.post<ModelItem>("/api/master/models", {
        makeId: make.id,
        vehicleTypeId: type.id,
        categoryId: cat.id,
        name: p.model.trim(),
        capacity: p.capacity.trim(),
        isActive: true,
      }));
    await qc.invalidateQueries({ queryKey: ["bootstrap"] });
    form.setValue(
      "vehicle",
      {
        categoryId: cat.id,
        makeId: make.id,
        typeId: type.id,
        modelName: model.name,
        capacity: model.capacity,
      },
      { shouldValidate: true },
    );
    return model.id;
  };
  const addPending = async () => {
    if (!pending) return;
    setAdding(true);
    try {
      const id = await ensureVehicle(pending);
      setModelId(id);
      setPending(null);
      notify.ok("Added to master data");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not add to master data");
    } finally {
      setAdding(false);
    }
  };

  const submit = form.handleSubmit(async (v) => {
    setErr("");
    let modelId2 = modelId;
    if (!modelId2 && pending) {
      try {
        modelId2 = await ensureVehicle(pending);
        setPending(null);
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "Could not add the vehicle to master data",
        );
        return;
      }
    }
    if (!modelId2) {
      const missing: [keyof VehicleSel, string][] = [
        ["categoryId", "Select the category."],
        ["makeId", "Select the make."],
        ["typeId", "Select the type."],
        ["modelName", "Select the model."],
        ["capacity", "Select the capacity."],
      ];
      let any = false;
      for (const [k, m] of missing)
        if (!v.vehicle[k]) {
          form.setError(`vehicle.${k}`, { message: m });
          any = true;
        }
      if (!any)
        form.setError("vehicle.capacity", {
          message:
            "This vehicle combination is not in master data. Add it under Master data first.",
        });
      return;
    }
    const ah = b.ahRatings.find((a) => a.id === v.ahId)!;
    const conn = b.connectors.find(
      (x) => x.name.toLowerCase() === v.connector.trim().toLowerCase(),
    );
    const spec = {
      modelId: modelId2,
      connectorTypeId: conn?.id ?? (v.connector.trim() ? "" : undefined),
      connectorName:
        conn || !v.connector.trim() ? undefined : v.connector.trim(),
      voltageV: Number(v.volt),
      ahValue: ah.value,
      ahStandard: ah.standard,
      lengthMm: v.l ? Number(v.l) : undefined,
      widthMm: v.w ? Number(v.w) : undefined,
      heightMm: v.h ? Number(v.h) : undefined,
    };
    try {
      let d: DrawingDetail;
      if (mode === "new")
        d = await api.post("/api/drawings", {
          ...spec,
          drawingNumber: v.number,
          comments: v.comments,
          competitorDrawingNumber: v.competitor,
          fileId: v.fileId,
          changeNotes: v.notes || undefined,
          requestId: requestId || undefined,
        });
      else if (mode === "edit")
        d = await api.put(`/api/drawings/${id}`, {
          ...spec,
          drawingNumber: v.number,
          comments: v.comments,
          competitorDrawingNumber: v.competitor,
          status: v.status,
          fileId: v.fileId || undefined,
        });
      else
        d = await api.post(`/api/drawings/${id}/revisions`, {
          ...spec,
          fileId: v.fileId,
          changeNotes: v.notes,
          newDrawingNumber: v.number,
          requestId: requestId || undefined,
        });
      for (const k of [
        "drawings",
        "drawing",
        "dashboard",
        "requests",
        "request",
        "search",
        "by-number",
        "bootstrap",
      ])
        qc.invalidateQueries({ queryKey: [k] });
      notify.ok(
        requestId
          ? `Drawing ${d.drawing.drawingNumber} saved — ticket closed and requester notified`
          : `Drawing ${d.drawing.drawingNumber} saved`,
      );
      nav(`/drawings/${d.drawing.id}`);
    } catch (e) {
      setErr(
        applyServerErrors(form, e, {
          drawingNumber: "number",
          newDrawingNumber: "number",
          modelId: "vehicle.capacity",
          voltageV: "volt",
          ahValue: "ahId",
          lengthMm: "l",
          widthMm: "w",
          heightMm: "h",
          connectorTypeId: "connector",
          connectorName: "connector",
          changeNotes: "notes",
          fileId: "fileId",
        }) ?? "",
      );
    }
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin · Drawings"
        admin
        title={title}
        sub={
          mode === "revision"
            ? `Saves the next revision as a new drawing (${currentNo} stays available). All revisions remain linked to the same vehicle.`
            : mode === "edit"
              ? "Change the drawing details. To replace the file, add a revision instead."
              : "Upload the file, then enter its details. The generated URL can be reused in the bulk-import Excel."
        }
      />
      {req.data && (
        <Advisory
          tone="blue"
          icon={Info}
          title={`Working on ${req.data.ticketNo} — ${req.data.title}`}
        >
          Saving this drawing closes the ticket automatically and e-mails{" "}
          {req.data.requestedByName}.{" "}
          <Link className="font-bold underline" to={`/requests/${req.data.id}`}>
            View request
          </Link>
        </Advisory>
      )}
      <Form {...form}>
        <form onSubmit={submit} noValidate>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="grid gap-0">
              <FormError>{err}</FormError>
              {mode !== "edit" && (
                <SectionCard
                  icon={Upload}
                  title="1 · Upload the drawing file *"
                >
                  <FileUpload
                    endpoint="/api/files/drawings"
                    accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg"
                    hint="DWG, DXF, PDF, PNG or JPG · up to 50 MB · PDF/PNG/JPG also give users an in-browser preview"
                    value={file}
                    showUrl
                    onUploaded={(f) => {
                      setFile(f);
                      form.setValue("fileId", f.id, { shouldValidate: true });
                    }}
                    onCleared={() => {
                      setFile(null);
                      form.setValue("fileId", "");
                    }}
                  />
                  {form.formState.errors.fileId && (
                    <p
                      role="alert"
                      className="mt-1.5 text-xs font-semibold text-destructive"
                    >
                      {form.formState.errors.fileId.message}
                    </p>
                  )}
                </SectionCard>
              )}
              {mode === "edit" && (
                <SectionCard
                  icon={Upload}
                  title="1 · Replace drawing file (optional)"
                >
                  <p className="mb-3 text-[13px] text-muted-foreground">
                    Current file:{" "}
                    <b className="text-foreground">
                      {src.data?.file?.name ?? "none"}
                    </b>
                    . Upload here only to <b>correct a wrong upload</b> - the
                    file is swapped in place and <b>no new revision</b> is
                    created. Use "Upload revised drawing" for a real revision.
                  </p>
                  <FileUpload
                    endpoint="/api/files/drawings"
                    accept=".dwg,.dxf,.pdf,.png,.jpg,.jpeg"
                    hint="DWG, DXF, PDF, PNG or JPG · up to 50 MB"
                    value={file}
                    showUrl
                    onUploaded={(f) => {
                      setFile(f);
                      form.setValue("fileId", f.id, { shouldValidate: true });
                    }}
                    onCleared={() => {
                      setFile(null);
                      form.setValue("fileId", "");
                    }}
                  />
                  {form.formState.errors.fileId && (
                    <p
                      role="alert"
                      className="mt-1.5 text-xs font-semibold text-destructive"
                    >
                      {form.formState.errors.fileId.message}
                    </p>
                  )}
                </SectionCard>
              )}
              {pending && !modelId && (
                <Advisory
                  tone="amber"
                  title="Requested vehicle is not fully in master data"
                >
                  The requester entered{" "}
                  <b>
                    {pending.category} · {pending.make} · {pending.type} ·{" "}
                    {pending.model} · {pending.capacity}
                  </b>
                  . Missing parts are added to master data automatically when
                  you save, or add them now.
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-3"
                    disabled={adding}
                    onClick={addPending}
                  >
                    {adding && <Spinner />}Add to master data now
                  </Button>
                </Advisory>
              )}
              <SectionCard icon={Layers} title="2 · Which vehicle is it for?">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <VehicleFields onResolved={setModelId} />
                </div>
              </SectionCard>
              <SectionCard icon={Database} title="3 · Drawing number & battery">
                <div className="grid gap-4 md:grid-cols-3">
                  <FInput
                    control={control}
                    name="number"
                    label="Drawing number"
                    required
                    mono
                    placeholder={example}
                    transform={(v, prev) =>
                      formatByMask(v, mask, v.length < prev.length)
                    }
                    hint={`${maskHint(mask)}${mode === "revision" ? " · own number for the revision - earlier revisions stay available" : ""}`}
                  />
                  <FSelect
                    control={control}
                    name="volt"
                    label="Voltage (V)"
                    required
                    options={b.voltages.map((v) => ({
                      value: String(v.valueV),
                      label: `${v.valueV} V`,
                    }))}
                  />
                  <FSelect
                    control={control}
                    name="ahId"
                    label="Ah rating"
                    required
                    options={b.ahRatings.map((a) => ({
                      value: a.id,
                      label: a.label,
                    }))}
                  />
                </div>
                <div className="mt-5 mb-2 text-xs font-bold">
                  Tray size (mm)
                  {mode !== "revision" && (
                    <>
                      {" "}
                      <span className="text-destructive">*</span>
                    </>
                  )}{" "}
                  <span className="font-normal text-muted-foreground">
                    · 3 or 4 digits each
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <FInput
                    control={control}
                    name="l"
                    label="Length (L)"
                    numeric
                    mono
                    maxLength={4}
                    placeholder="e.g. 1220"
                  />
                  <FInput
                    control={control}
                    name="w"
                    label="Width (W)"
                    numeric
                    mono
                    maxLength={4}
                    placeholder="e.g. 350"
                  />
                  <FInput
                    control={control}
                    name="h"
                    label="Height (H)"
                    numeric
                    mono
                    maxLength={4}
                    placeholder="e.g. 780"
                  />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <FInput
                    control={control}
                    name="connector"
                    label="End connector"
                    required={mode !== "revision"}
                    list="connector-list"
                    maxLength={100}
                    placeholder="Pick from the list or type your own"
                    hint="Not in the list? Type it - it is added to master data."
                  />
                  <datalist id="connector-list">
                    {b.connectors.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  {mode === "edit" && (
                    <FSelect
                      control={control}
                      name="status"
                      label="Status"
                      options={[
                        { value: "Active", label: "Active" },
                        { value: "Archived", label: "Archived" },
                      ]}
                    />
                  )}
                </div>
                {mode === "revision" && (
                  <div className="mt-5">
                    <FTextarea
                      control={control}
                      name="notes"
                      label="What changed in this revision?"
                      required
                      maxLength={2000}
                    />
                  </div>
                )}
              </SectionCard>
              {mode !== "revision" && (
                <SectionCard icon={Info} title="4 · Optional">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FInput
                      control={control}
                      name="competitor"
                      label="Competitor drawing number"
                      mono
                      maxLength={60}
                    />
                  </div>
                  <div className="mt-4">
                    <FTextarea
                      control={control}
                      name="comments"
                      label="Comments"
                      maxLength={2000}
                    />
                  </div>
                </SectionCard>
              )}
            </div>
            <aside className="grid gap-0 xl:sticky xl:top-4">
              {mode !== "revision" && (
                <ExistingDrawings
                  number={form.watch("number")}
                  modelId={modelId ?? ""}
                  fileId={form.watch("fileId")}
                  ignoreId={mode === "edit" ? id : undefined}
                  complete={form.watch("number").length === mask.length}
                />
              )}
              <Summary
                items={[
                  [
                    "File",
                    file?.name ??
                      (mode === "edit" ? src.data?.file?.name : undefined),
                  ],
                  ["Drawing number", form.watch("number") || undefined],
                  [
                    "Voltage",
                    form.watch("volt") ? `${form.watch("volt")} V` : undefined,
                  ],
                  [
                    "Ah rating",
                    b.ahRatings.find((a) => a.id === form.watch("ahId"))?.label,
                  ],
                  [
                    "Tray size",
                    form.watch("l") && form.watch("w") && form.watch("h")
                      ? `${form.watch("l")} × ${form.watch("w")} × ${form.watch("h")} mm`
                      : undefined,
                  ],
                  ["Connector", form.watch("connector") || undefined],
                ]}
              />
            </aside>
          </div>
          <div className="sticky bottom-0 z-10 mt-5 flex justify-end gap-2.5 border-t bg-background/90 py-3 backdrop-blur">
            <Button asChild variant="outline">
              <Link to={mode === "new" ? "/admin/drawings" : `/drawings/${id}`}>
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Spinner /> : <Check />}
              {mode === "new"
                ? "Save drawing"
                : mode === "edit"
                  ? "Save changes"
                  : "Save revision"}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
