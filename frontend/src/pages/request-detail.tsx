import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Download, Eye, FileText, Send, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Comment, RequestDetail, RequestStatus, User } from "@/lib/types";
import {
  ago,
  fileUrl,
  fmtDate,
  fmtDateTime,
  fmtSize,
  initials,
  statusLabel,
} from "@/lib/util";
import { commentSchema } from "@/lib/schemas";
import { useAuth, useIsAdmin } from "@/stores/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Advisory,
  Card2,
  ErrorState,
  FormError,
  Loading,
  PageHeader,
  PriorityBadge,
  SpecCard,
  SpecRow,
  Spinner,
  StatusBadge,
  errMsg,
  notify,
} from "@/components/app/common";
import { FInput, FSelect, FTextarea } from "@/components/app/fields";
import { Dims } from "@/components/app/drawing-bits";
import { VisualComparison } from "@/components/app/visual-comparison";

const FLOW: RequestStatus[] = [
  "Submitted",
  "InReview",
  "Assigned",
  "InProgress",
  "Completed",
];

function Stepper({ status }: { status: RequestStatus }) {
  const rejected = status === "Rejected";
  const idx = rejected ? 2 : FLOW.indexOf(status);
  return (
    <ol className="flex" aria-label="Request progress">
      {FLOW.map((s, i) => {
        const last = i === FLOW.length - 1;
        const state =
          rejected && last
            ? "rejected"
            : i < idx || status === "Completed"
              ? "done"
              : i === idx
                ? "current"
                : "todo";
        return (
          <li key={s} className="relative flex-1 text-center">
            {i > 0 && (
              <div
                className={cn(
                  "absolute top-[15px] -left-1/2 h-0.5 w-full",
                  state === "done" || state === "current"
                    ? "bg-success"
                    : "bg-muted",
                )}
              />
            )}
            <motion.div
              initial={false}
              animate={{ scale: state === "current" ? 1.1 : 1 }}
              className={cn(
                "relative z-10 mx-auto mb-2 flex size-[30px] items-center justify-center rounded-full text-xs font-bold",
                state === "done" && "bg-success text-white",
                state === "current" &&
                  "bg-brand text-white ring-4 ring-brand-soft",
                state === "rejected" && "bg-destructive text-white",
                state === "todo" && "bg-muted text-muted-foreground",
              )}
            >
              {state === "done" ? (
                <Check className="size-3.5" />
              ) : state === "rejected" ? (
                <X className="size-3.5" />
              ) : (
                i + 1
              )}
            </motion.div>
            <div
              className={cn(
                "text-xs font-bold",
                state === "todo" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {state === "rejected" ? "Rejected" : statusLabel(s)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function RequestDetailPage() {
  const { id = "" } = useParams();
  const user = useAuth((s) => s.user);
  const admin = useIsAdmin();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["request", id],
    queryFn: () => api.get<RequestDetail>(`/api/requests/${id}`),
    retry: false,
  });
  const comments = useQuery({
    queryKey: ["comments", id],
    queryFn: () => api.get<Comment[]>(`/api/requests/${id}/comments`),
    refetchInterval: 20_000,
    enabled: !!q.data,
  });
  const [modal, setModal] = useState<
    null | "status" | "assign" | "existing" | "reject"
  >(null);
  const refresh = () => {
    for (const k of ["request", "requests", "request-stats", "dashboard"])
      qc.invalidateQueries({ queryKey: [k] });
  };
  const form = useForm({
    resolver: zodResolver(commentSchema),
    defaultValues: { body: "" },
  });
  const send = useMutation({
    mutationFn: (body: string) =>
      api.post<Comment>(`/api/requests/${id}/comments`, { body }),
    onSuccess: () => {
      form.reset();
      qc.invalidateQueries({ queryKey: ["comments", id] });
      notify.ok("Message sent — the other party was e-mailed");
    },
    onError: (e) => notify.err(errMsg(e)),
  });
  if (q.isLoading) return <Loading />;
  if (q.error || !q.data) return <ErrorState error={q.error} />;
  const r = q.data;
  const d = r.relatedDrawing;
  const changed = (
    cur: string | number | null | undefined,
    req: string | number | null | undefined,
    unit = "",
  ) =>
    req == null || req === "" ? (
      "—"
    ) : cur != null && String(cur) !== String(req) ? (
      <>
        <span className="text-muted-foreground line-through">
          {cur}
          {unit}
        </span>{" "}
        →{" "}
        <span className="font-bold text-brand-dark">
          {req}
          {unit}
        </span>
      </>
    ) : (
      `${req}${unit}`
    );
  return (
    <>
      <PageHeader
        eyebrow={`${r.type === "New" ? "New drawing request" : "Modification request"} · ${r.ticketNo}`}
        admin={admin}
        title={r.title}
        sub={`Raised by ${r.requestedByName} on ${fmtDate(r.submittedAtUtc)}`}
        actions={
          <>
            <StatusBadge s={r.status} />
            <PriorityBadge p={r.priority} />
            {r.canManage && (
              <>
                {r.type === "Modification" && d ? (
                  <>
                    <Button asChild>
                      <Link
                        to={`/admin/drawings/${d.id}/revision?requestId=${r.id}`}
                      >
                        <Upload />
                        Upload revised drawing
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to={`/admin/drawings/new?requestId=${r.id}`}>
                        Create as new drawing
                      </Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild>
                    <Link to={`/admin/drawings/new?requestId=${r.id}`}>
                      <Upload />
                      Create &amp; upload drawing
                    </Link>
                  </Button>
                )}
                <Button variant="outline" onClick={() => setModal("status")}>
                  Update status
                </Button>
                <Button variant="outline" onClick={() => setModal("assign")}>
                  Assign
                </Button>
                <Button variant="outline" onClick={() => setModal("existing")}>
                  Close with existing drawing
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setModal("reject")}
                >
                  Reject
                </Button>
              </>
            )}
          </>
        }
      />
      <Card2 className="mb-6 p-5">
        <Stepper status={r.status} />
        {r.closureNote && r.isClosed && (
          <Advisory
            className="mt-4 mb-0"
            tone={r.status === "Completed" ? "green" : "amber"}
            icon={r.status === "Completed" ? Check : X}
            title={r.status === "Completed" ? "Completed" : "Rejected"}
          >
            {r.closureNote}
            {r.resultDrawingId && (
              <>
                {" "}
                ·{" "}
                <Link
                  className="font-bold underline"
                  to={`/drawings/${r.resultDrawingId}`}
                >
                  Open drawing {r.resultDrawingNumber}
                </Link>
              </>
            )}
          </Advisory>
        )}
      </Card2>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_330px]">
        <div>
          <VisualComparison r={r} />
          <SpecCard
            title={
              r.type === "Modification"
                ? "Requested changes"
                : "Requested specification"
            }
          >
            {r.type === "Modification" && d ? (
              <>
                <SpecRow label="Drawing">
                  <Link
                    className="font-mono text-brand-dark"
                    to={`/drawings/${d.id}`}
                  >
                    {d.drawingNumber}
                  </Link>
                </SpecRow>
                <SpecRow label="Vehicle">{`${d.make} ${d.model} · ${d.capacity}`}</SpecRow>
                <SpecRow label="Change type">{r.changeType}</SpecRow>
                <SpecRow label="Voltage">
                  {changed(d.voltageV, r.voltageV, " V")}
                </SpecRow>
                <SpecRow label="Ah rating">{changed(d.ah, r.ah)}</SpecRow>
                <SpecRow label="Connector">
                  {changed(d.connector, r.connectorName)}
                </SpecRow>
                <SpecRow label="Length">
                  {changed(d.lengthMm, r.lengthMm, " mm")}
                </SpecRow>
                <SpecRow label="Width">
                  {changed(d.widthMm, r.widthMm, " mm")}
                </SpecRow>
                <SpecRow label="Height">
                  {changed(d.heightMm, r.heightMm, " mm")}
                </SpecRow>
              </>
            ) : (
              <>
                <SpecRow label="Category">{r.categoryName}</SpecRow>
                <SpecRow label="Make">{r.makeName}</SpecRow>
                <SpecRow label="Type">{r.vehicleTypeName}</SpecRow>
                <SpecRow label="Model">{r.modelName}</SpecRow>
                <SpecRow label="Capacity">{r.capacity}</SpecRow>
                <SpecRow label="Voltage">
                  {r.voltageV && `${r.voltageV} V`}
                </SpecRow>
                <SpecRow label="Ah rating">{r.ah}</SpecRow>
                <SpecRow label="Tray (mm)">
                  {r.lengthMm && (
                    <Dims
                      d={{
                        lengthMm: r.lengthMm,
                        widthMm: r.widthMm ?? 0,
                        heightMm: r.heightMm ?? 0,
                      }}
                    />
                  )}
                </SpecRow>
                <SpecRow label="End connector">{r.connectorName}</SpecRow>
                {d && (
                  <SpecRow label="Based on">
                    <Link
                      className="font-mono text-brand-dark"
                      to={`/drawings/${d.id}`}
                    >
                      {d.drawingNumber}
                    </Link>
                  </SpecRow>
                )}
              </>
            )}
            <SpecRow label="Needed by">
              {r.targetDate && fmtDate(r.targetDate)}
            </SpecRow>
          </SpecCard>
          <SpecCard
            title={
              r.type === "Modification"
                ? "Description of change"
                : "Requirement comments"
            }
          >
            <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              {r.description}
            </div>
            {r.reason && (
              <>
                <div className="mt-4 mb-2 border-t pt-3 text-[11.5px] font-bold tracking-wide text-muted-foreground uppercase">
                  Reason
                </div>
                <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                  {r.reason}
                </div>
              </>
            )}
          </SpecCard>
          {r.attachments.length > 0 && (
            <SpecCard title="Reference attachments">
              {r.attachments.map((a) => (
                <div
                  key={a.fileId}
                  className="flex items-center gap-2.5 py-1.5"
                >
                  <FileText className="size-4 shrink-0" />
                  <span className="flex-1 [overflow-wrap:anywhere]">
                    {a.name}{" "}
                    <span className="text-muted-foreground">
                      {fmtSize(a.sizeBytes)}
                    </span>
                  </span>
                  {a.canPreview && (
                    <Button asChild variant="outline" size="icon-sm">
                      <a
                        href={fileUrl(a.fileId, true)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`View ${a.name}`}
                      >
                        <Eye />
                      </a>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="icon-sm">
                    <a
                      href={fileUrl(a.fileId)}
                      aria-label={`Download ${a.name}`}
                    >
                      <Download />
                    </a>
                  </Button>
                </div>
              ))}
            </SpecCard>
          )}
          <SpecCard title="Technical discussion">
            <div
              className="flex max-h-[460px] flex-col gap-3.5 overflow-auto p-0.5"
              aria-live="polite"
            >
              {comments.isLoading && <Loading />}
              {comments.data?.length === 0 && (
                <p className="text-muted-foreground">
                  No messages yet. Ask a question or share a clarification — the
                  other party is e-mailed.
                </p>
              )}
              {comments.data?.map((c) => {
                const me = c.authorId === user?.id;
                return (
                  <div
                    key={c.id}
                    className={cn("flex gap-2.5", me && "flex-row-reverse")}
                  >
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold text-white",
                        c.authorRole === "Admin" ? "bg-brand" : "bg-success",
                      )}
                    >
                      {initials(c.authorName)}
                    </div>
                    <div className="max-w-[78%]">
                      <div className="mb-1 text-xs font-bold">
                        {c.authorName}
                        {c.authorRole === "Admin" && " · Engineering"}
                        <span className="ml-2 font-medium text-muted-foreground">
                          {ago(c.createdAtUtc)}
                        </span>
                      </div>
                      <div
                        className={cn(
                          "rounded-r-2xl rounded-bl-2xl rounded-tl-sm border bg-panel px-3.5 py-2.5 text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere]",
                          me &&
                            "rounded-l-2xl rounded-tr-sm rounded-br-2xl border-brand/20 bg-brand-soft/50",
                        )}
                      >
                        {c.body}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Form {...form}>
              <form
                className="mt-4 flex items-end gap-2"
                onSubmit={form.handleSubmit((v) => send.mutate(v.body))}
              >
                <FTextarea
                  control={form.control}
                  name="body"
                  className="flex-1"
                  placeholder="Write a message… (Ctrl+Enter to send)"
                  aria-label="Message"
                  maxLength={4000}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      void form.handleSubmit((v) => send.mutate(v.body))();
                    }
                  }}
                />
                <Button type="submit" disabled={send.isPending}>
                  {send.isPending ? <Spinner /> : <Send />}Send
                </Button>
              </form>
            </Form>
          </SpecCard>
        </div>
        <div>
          <SpecCard title="People">
            <SpecRow label="Requester">
              <>
                {r.requestedByName}
                <div className="text-xs font-normal text-muted-foreground">
                  {r.requestedByEmail}
                </div>
              </>
            </SpecRow>
            <SpecRow label="Assigned to">
              {r.assignedToName ?? "Unassigned"}
            </SpecRow>
            <SpecRow label="Last updated">{ago(r.updatedAtUtc)}</SpecRow>
            <SpecRow label="Closed">
              {r.closedAtUtc && fmtDateTime(r.closedAtUtc)}
            </SpecRow>
          </SpecCard>
          <SpecCard title="Audit trail">
            {[...r.events].reverse().map((e) => (
              <div
                key={e.id}
                className="flex gap-3 border-b py-2.5 last:border-0"
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    e.toStatus === "Completed"
                      ? "bg-success"
                      : e.action === "Submitted"
                        ? "bg-muted-foreground"
                        : "bg-brand",
                  )}
                />
                <div>
                  <div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                    {fmtDateTime(e.createdAtUtc)}
                  </div>
                  <div className="text-[13px] [overflow-wrap:anywhere]">
                    <b>{e.toStatus ? statusLabel(e.toStatus) : e.action}</b>
                    {e.actorName && <> · {e.actorName}</>}
                    {e.note && (
                      <div className="text-muted-foreground">{e.note}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </SpecCard>
        </div>
      </div>
      {modal && (
        <AdminDialog
          kind={modal}
          r={r}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

const adminSchema = z.object({
  status: z.string(),
  assignee: z.string(),
  number: z.string(),
  note: z.string().max(2000),
});
function AdminDialog({
  kind,
  r,
  onClose,
  onDone,
}: {
  kind: "status" | "assign" | "existing" | "reject";
  r: RequestDetail;
  onClose: () => void;
  onDone: () => void;
}) {
  const [err, setErr] = useState("");
  const schema = adminSchema.superRefine((v, ctx) => {
    if (kind === "reject" && v.note.trim().length < 3)
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Please give a reason (sent to the requester).",
      });
    if (kind === "assign" && !v.assignee)
      ctx.addIssue({
        code: "custom",
        path: ["assignee"],
        message: "Select an admin.",
      });
    if (kind === "existing" && !v.number.trim())
      ctx.addIssue({
        code: "custom",
        path: ["number"],
        message: "Enter the existing drawing number.",
      });
  });
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      status: r.status === "Submitted" ? "InReview" : "InProgress",
      assignee: r.assignedToId ?? "",
      number: "",
      note: "",
    },
  });
  const admins = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.get<User[]>("/api/users/admins"),
    enabled: kind === "assign",
  });
  const title = {
    status: "Update status",
    assign: "Assign request",
    existing: "Close with an existing drawing",
    reject: "Reject request",
  }[kind];
  const go = form.handleSubmit(async (v) => {
    setErr("");
    try {
      if (kind === "assign")
        await api.post(`/api/requests/${r.id}/assign`, {
          assigneeId: v.assignee,
        });
      else if (kind === "status")
        await api.post(`/api/requests/${r.id}/status`, {
          status: v.status,
          note: v.note,
        });
      else if (kind === "reject")
        await api.post(`/api/requests/${r.id}/status`, {
          status: "Rejected",
          note: v.note,
        });
      else
        await api.post(`/api/requests/${r.id}/status`, {
          status: "Completed",
          note: v.note,
          resultDrawingNumber: v.number,
        });
      notify.ok("Request updated — the requester has been notified");
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    }
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <FormError>{err}</FormError>
        <Form {...form}>
          <form onSubmit={go} className="grid gap-4" noValidate>
            {kind === "status" && (
              <FSelect
                control={form.control}
                name="status"
                label="New status"
                options={(["InReview", "Assigned", "InProgress"] as const)
                  .filter((s) => s !== r.status)
                  .map((s) => ({ value: s, label: statusLabel(s) }))}
              />
            )}
            {kind === "assign" && (
              <FSelect
                control={form.control}
                name="assignee"
                label="Assign to"
                required
                placeholder="Select an admin"
                options={(admins.data ?? []).map((a) => ({
                  value: a.id,
                  label: a.fullName,
                }))}
              />
            )}
            {kind === "existing" && (
              <>
                <p className="text-[13px] text-muted-foreground">
                  About 60% of requests can be answered with a drawing that
                  already exists. Enter its number and the ticket closes; the
                  requester is e-mailed the link.
                </p>
                <FInput
                  control={form.control}
                  name="number"
                  label="Existing drawing number"
                  required
                  mono
                  placeholder="e.g. 25 600 001 A"
                />
              </>
            )}
            {kind !== "assign" && (
              <FTextarea
                control={form.control}
                name="note"
                label={
                  kind === "reject"
                    ? "Reason (sent to the requester)"
                    : "Note to requester (optional)"
                }
                required={kind === "reject"}
                maxLength={2000}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant={kind === "reject" ? "destructive" : "default"}
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && <Spinner />}
                {kind === "reject" ? "Reject request" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
