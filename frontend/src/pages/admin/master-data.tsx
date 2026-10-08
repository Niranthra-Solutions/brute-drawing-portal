import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Pencil, Plus, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api } from "@/lib/api";
import type { AhItem, ModelItem, NamedItem, VoltageItem } from "@/lib/types";
import { masterSchemas } from "@/lib/schemas";
import { useBootstrap } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card2,
  ConfirmDialog,
  Empty,
  ErrorState,
  FormError,
  Loading,
  PageHeader,
  Pill,
  Spinner,
  applyServerErrors,
  errMsg,
  notify,
} from "@/components/app/common";
import { VirtualTable } from "@/components/app/data-table";
import { FCheckbox, FInput, FSelect } from "@/components/app/fields";

type Tab =
  | "categories"
  | "vehicle-types"
  | "makes"
  | "connectors"
  | "models"
  | "voltages"
  | "ah-ratings";
const TABS: { id: Tab; label: string; one: string }[] = [
  { id: "categories", label: "Categories", one: "category" },
  { id: "makes", label: "Makes (OEM)", one: "make" },
  { id: "vehicle-types", label: "Vehicle types", one: "vehicle type" },
  { id: "models", label: "Models & capacity", one: "model" },
  { id: "connectors", label: "Connectors", one: "connector" },
  { id: "voltages", label: "Voltages", one: "voltage" },
  { id: "ah-ratings", label: "Ah ratings", one: "Ah rating" },
];
const path = (t: Tab) =>
  ["models", "voltages", "ah-ratings"].includes(t)
    ? `/api/master/${t}`
    : `/api/master/named/${t}`;
const idCell = (id: string) => (
  <button
    type="button"
    title="Click to copy"
    className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
    onClick={() => {
      void navigator.clipboard?.writeText(id);
      notify.ok("ID copied");
    }}
  >
    {id.replace("_", "-").toUpperCase()}
  </button>
);
const active = (a: boolean) => (
  <Pill tone={a ? "green" : "grey"}>{a ? "Active" : "Inactive"}</Pill>
);

export default function MasterDataPage() {
  const [tab, setTab] = useState<Tab>("categories");
  const [edit, setEdit] = useState<unknown | "new" | null>(null);
  const [del, setDel] = useState<{ id: string; label: string } | null>(null);
  const qc = useQueryClient();
  const { data: b } = useBootstrap();
  const list = useQuery({
    queryKey: ["master", tab],
    queryFn: () => api.get<unknown[]>(path(tab)),
  });
  const cur = TABS.find((t) => t.id === tab)!;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["master", tab] });
    qc.invalidateQueries({ queryKey: ["bootstrap"] });
  };
  const nameOf = (l: NamedItem[] | undefined, id: string) =>
    l?.find((x) => x.id === id)?.name ?? "—";
  const actions = <T extends { id: string }>(
    label: (r: T) => string,
  ): ColumnDef<T> => ({
    id: "a",
    header: "",
    meta: { className: "w-24" },
    cell: ({ row: { original: r } }) => (
      <div className="flex justify-end gap-1.5">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => setEdit(r)}
          aria-label={`Edit ${label(r)}`}
        >
          <Pencil />
        </Button>
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={() => setDel({ id: r.id, label: label(r) })}
          aria-label={`Delete ${label(r)}`}
        >
          <Trash2 />
        </Button>
      </div>
    ),
  });
  // categories a make / vehicle type is used in (derived from the models that reference it)
  const catsFor = (key: "makeId" | "vehicleTypeId", id: string) =>
    [
      ...new Set(
        (b?.models ?? [])
          .filter((m) => m[key] === id)
          .map((m) => nameOf(b?.categories, m.categoryId)),
      ),
    ]
      .sort()
      .join(", ") || "—";
  const named: ColumnDef<NamedItem>[] = [
    {
      header: "ID",
      meta: { className: "w-56" },
      cell: ({ row }) => idCell(row.original.id),
    },
    { header: "Name", cell: ({ row }) => <b>{row.original.name}</b> },
    ...(tab === "makes" || tab === "vehicle-types"
      ? [
          {
            header: "Category",
            cell: ({ row }: { row: { original: NamedItem } }) =>
              catsFor(
                tab === "makes" ? "makeId" : "vehicleTypeId",
                row.original.id,
              ),
          } as ColumnDef<NamedItem>,
        ]
      : []),
    { header: "Sort", cell: ({ row }) => row.original.sortOrder },
    { header: "Status", cell: ({ row }) => active(row.original.isActive) },
    actions((r) => r.name),
  ];
  const models: ColumnDef<ModelItem>[] = [
    {
      header: "ID",
      meta: { className: "w-56" },
      cell: ({ row }) => idCell(row.original.id),
    },
    {
      header: "Category",
      cell: ({ row }) => nameOf(b?.categories, row.original.categoryId),
    },
    {
      header: "Make",
      cell: ({ row }) => nameOf(b?.makes, row.original.makeId),
    },
    { header: "Model", cell: ({ row }) => <b>{row.original.name}</b> },
    { header: "Capacity", cell: ({ row }) => row.original.capacity },
    {
      header: "Type",
      cell: ({ row }) => nameOf(b?.vehicleTypes, row.original.vehicleTypeId),
    },
    { header: "Status", cell: ({ row }) => active(row.original.isActive) },
    actions((r) => r.name),
  ];
  const volts: ColumnDef<VoltageItem>[] = [
    {
      header: "ID",
      meta: { className: "w-56" },
      cell: ({ row }) => idCell(row.original.id),
    },
    { header: "Voltage", cell: ({ row }) => <b>{row.original.valueV} V</b> },
    { header: "Status", cell: ({ row }) => active(row.original.isActive) },
    actions((r) => `${r.valueV} V`),
  ];
  const ahs: ColumnDef<AhItem>[] = [
    {
      header: "ID",
      meta: { className: "w-56" },
      cell: ({ row }) => idCell(row.original.id),
    },
    { header: "Ah rating", cell: ({ row }) => <b>{row.original.label}</b> },
    { header: "Value", cell: ({ row }) => row.original.value },
    { header: "Standard", cell: ({ row }) => row.original.standard || "—" },
    { header: "Status", cell: ({ row }) => active(row.original.isActive) },
    actions((r) => r.label),
  ];
  const rows = list.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow="Admin"
        admin
        title="Master data"
        sub="Add new OEMs, models, voltages, Ah ratings and connectors as the business grows. Values in use are deactivated instead of deleted, so drawings stay intact."
        actions={
          <Button onClick={() => setEdit("new")}>
            <Plus />
            Add {cur.one}
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as Tab);
          setEdit(null);
        }}
        className="mb-4"
      >
        <TabsList className="h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="px-3.5 py-2 text-[13px] font-bold"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Card2 className="overflow-hidden">
        {list.isLoading ? (
          <Loading />
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : rows.length === 0 ? (
          <Empty icon={Boxes} title={`No ${cur.label.toLowerCase()} yet`} />
        ) : (
          <>
            {tab === "models" && (
              <VirtualTable
                columns={models}
                data={rows as ModelItem[]}
                height={560}
              />
            )}
            {tab === "voltages" && (
              <VirtualTable
                columns={volts}
                data={rows as VoltageItem[]}
                height={560}
              />
            )}
            {tab === "ah-ratings" && (
              <VirtualTable
                columns={ahs}
                data={rows as AhItem[]}
                height={560}
              />
            )}
            {!["models", "voltages", "ah-ratings"].includes(tab) && (
              <VirtualTable
                columns={named}
                data={rows as NamedItem[]}
                height={560}
              />
            )}
            <div className="border-t px-5 py-3 text-xs text-muted-foreground">
              {rows.length.toLocaleString()} records
            </div>
          </>
        )}
      </Card2>
      {edit !== null && (
        <EditDialog
          key={tab + String((edit as { id?: string })?.id)}
          tab={tab}
          label={cur.one}
          item={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            refresh();
            notify.ok("Saved");
          }}
        />
      )}
      <ConfirmDialog
        open={!!del}
        onOpenChange={(o) => !o && setDel(null)}
        danger
        title={`Delete ${cur.one}?`}
        confirmLabel="Delete"
        message={
          <>
            Delete <b>{del?.label}</b>? Values used by drawings cannot be
            deleted — deactivate them instead.
          </>
        }
        onConfirm={async () => {
          try {
            await api.del(`${path(tab)}/${del!.id}`);
            refresh();
            notify.ok("Deleted");
          } catch (e) {
            notify.err(errMsg(e));
            throw e;
          }
        }}
      />
    </>
  );
}

function EditDialog({
  tab,
  label,
  item,
  onClose,
  onSaved,
}: {
  tab: Tab;
  label: string;
  item: unknown;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: b } = useBootstrap();
  const it = item as Record<string, string | number | boolean> | null;
  const schema =
    tab === "voltages"
      ? masterSchemas.voltage
      : tab === "ah-ratings"
        ? masterSchemas.ah
        : tab === "models"
          ? masterSchemas.model
          : masterSchemas.named;
  type V = Record<string, string | boolean>;
  const defaults: V =
    tab === "voltages"
      ? ({
          valueV: String(it?.valueV ?? ""),
          isActive: it?.isActive ?? true,
        } as V)
      : tab === "ah-ratings"
        ? ({
            value: String(it?.value ?? ""),
            standard: String(it?.standard ?? ""),
            isActive: it?.isActive ?? true,
          } as V)
        : tab === "models"
          ? ({
              makeId: String(it?.makeId ?? ""),
              vehicleTypeId: String(it?.vehicleTypeId ?? ""),
              categoryId: String(it?.categoryId ?? ""),
              name: String(it?.name ?? ""),
              capacity: String(it?.capacity ?? ""),
              isActive: it?.isActive ?? true,
            } as V)
          : ({
              name: String(it?.name ?? ""),
              sortOrder: String(it?.sortOrder ?? 0),
              isActive: it?.isActive ?? true,
            } as V);
  const form = useForm<V>({
    resolver: zodResolver(schema as z.ZodType<V>),
    defaultValues: defaults,
  });
  const [err, setErr] = useState("");
  const save = form.handleSubmit(async (v) => {
    setErr("");
    const body =
      tab === "voltages"
        ? { valueV: Number(v.valueV), isActive: v.isActive }
        : tab === "ah-ratings"
          ? {
              value: Number(v.value),
              standard: v.standard,
              isActive: v.isActive,
            }
          : tab === "models"
            ? v
            : {
                name: v.name,
                sortOrder: Number(v.sortOrder) || 0,
                isActive: v.isActive,
              };
    try {
      if (it) await api.put(`${path(tab)}/${it.id}`, body);
      else await api.post(path(tab), body);
      onSaved();
    } catch (e) {
      setErr(applyServerErrors(form, e) ?? "");
    }
  });
  const c = form.control;
  const opts = (l?: NamedItem[]) =>
    (l ?? []).map((x) => ({ value: x.id, label: x.name }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {it ? "Edit" : "Add"} {label}
          </DialogTitle>
          <DialogDescription className="sr-only">Master data</DialogDescription>
        </DialogHeader>
        <FormError>{err}</FormError>
        <Form {...form}>
          <form onSubmit={save} className="grid gap-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {tab === "models" && (
                <>
                  <FSelect
                    control={c}
                    name="makeId"
                    label="Make"
                    required
                    options={opts(b?.makes)}
                  />
                  <FSelect
                    control={c}
                    name="vehicleTypeId"
                    label="Vehicle type"
                    required
                    options={opts(b?.vehicleTypes)}
                  />
                  <FSelect
                    control={c}
                    name="categoryId"
                    label="Category"
                    required
                    options={opts(b?.categories)}
                  />
                </>
              )}
              {(tab === "models" ||
                !["voltages", "ah-ratings"].includes(tab)) && (
                <FInput
                  control={c}
                  name="name"
                  label={tab === "models" ? "Model no." : "Name"}
                  required
                  maxLength={120}
                />
              )}
              {tab === "models" && (
                <FInput
                  control={c}
                  name="capacity"
                  label="Capacity"
                  required
                  maxLength={40}
                  hint="e.g. 1.8 T"
                />
              )}
              {tab === "voltages" && (
                <FInput
                  control={c}
                  name="valueV"
                  label="Voltage (V)"
                  required
                  numeric
                />
              )}
              {tab === "ah-ratings" && (
                <>
                  <FInput
                    control={c}
                    name="value"
                    label="Ah value"
                    required
                    numeric
                  />
                  <FInput
                    control={c}
                    name="standard"
                    label="Standard (optional)"
                    maxLength={20}
                    hint="e.g. DIN → shown as 620(DIN)"
                  />
                </>
              )}
              {!["models", "voltages", "ah-ratings"].includes(tab) && (
                <FInput
                  control={c}
                  name="sortOrder"
                  label="Sort order"
                  numeric
                />
              )}
            </div>
            <FCheckbox
              control={c}
              name="isActive"
              label="Active (shown in drop-downs)"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
