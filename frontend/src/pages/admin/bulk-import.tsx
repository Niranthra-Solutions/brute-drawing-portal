import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Layers,
  Upload,
} from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { api, postForm } from "@/lib/api";
import type { BulkCheck, BulkJob } from "@/lib/types";
import { fmtDateTime } from "@/lib/util";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
  Empty,
  ErrorState,
  FormError,
  Loading,
  PageHeader,
  StatusBadge,
  errMsg,
  notify,
} from "@/components/app/common";
import { VirtualTable } from "@/components/app/data-table";
import { BulkFilesUploader } from "@/components/app/bulk-files-uploader";

interface RowError {
  rowNumber: number;
  drawingNumber: string | null;
  message: string;
}
const errCols: ColumnDef<RowError>[] = [
  {
    header: "Row",
    meta: { className: "w-20" },
    cell: ({ row }) => (
      <span className="font-mono">{row.original.rowNumber}</span>
    ),
  },
  {
    header: "Drawing no.",
    meta: { className: "w-40" },
    cell: ({ row }) => (
      <span className="font-mono">{row.original.drawingNumber ?? "—"}</span>
    ),
  },
  { header: "Problem", cell: ({ row }) => row.original.message },
];

export default function BulkImportPage() {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [skip, setSkip] = useState(true);
  const [auto, setAuto] = useState(true);
  const [err, setErr] = useState("");
  const [show, setShow] = useState<BulkJob | null>(null);
  const [check, setCheck] = useState<BulkCheck | null>(null);
  const [filesVersion, setFilesVersion] = useState(0);
  const jobs = useQuery({
    queryKey: ["bulk-jobs"],
    queryFn: () => api.get<BulkJob[]>("/api/bulk-import"),
    refetchInterval: (q) =>
      q.state.data?.some((j) => j.status === "Queued" || j.status === "Running")
        ? 1500
        : false,
  });
  // compare the chosen Excel with the uploaded files; runs again by itself after more files are uploaded
  const checkM = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      return postForm<BulkCheck>("/api/bulk-import/check", fd);
    },
    onSuccess: (r) => {
      setCheck(r);
      setErr("");
    },
    onError: (e) => {
      setCheck(null);
      setErr(errMsg(e));
    },
  });
  const runCheck = checkM.mutate;
  useEffect(() => {
    if (file) runCheck(file);
  }, [file, filesVersion, runCheck]);
  const start = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("file", file!);
      fd.append("skipDuplicates", String(skip));
      fd.append("autoCreateMaster", String(auto));
      return postForm<BulkJob>("/api/bulk-import", fd);
    },
    onSuccess: () => {
      setFile(null);
      setCheck(null);
      setErr("");
      qc.invalidateQueries({ queryKey: ["bulk-jobs"] });
      notify.ok(
        "Import queued — it runs in the background; you can keep working",
      );
    },
    onError: (e) => setErr(errMsg(e)),
  });
  const running = jobs.data?.some(
    (j) => j.status === "Queued" || j.status === "Running",
  );
  // an import may have created makes/models/etc. - refresh the cached master data when a job finishes
  useEffect(() => {
    if (!running) qc.invalidateQueries({ queryKey: ["bootstrap"] });
  }, [running, qc]);
  return (
    <>
      <PageHeader
        eyebrow="Admin · Drawings"
        admin
        title="Bulk upload drawings"
        sub="Upload the drawing files first, then the Excel with their details. Each row is matched to its file by drawing number, voltage and Ah, and any file that is still missing is listed so you can upload it."
      />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-5">
          <Card2 className="p-5">
            <StepTitle n={1} title="Upload the drawing files" />
            <BulkFilesUploader
              onBatchDone={() => setFilesVersion((v) => v + 1)}
            />
          </Card2>
          <Card2 className="p-5">
            <StepTitle n={2} title="Upload the drawing data (Excel)" />
            <p className="mb-3 text-[13px] text-muted-foreground">
              One row per drawing: number, vehicle, voltage, Ah rating, tray
              size and connector. Leave <b>DrawingUrl</b> empty: the file is
              found by the name you gave it in step 1.
            </p>
            <Button asChild variant="outline" className="mb-5">
              <a href="/api/bulk-import/template">
                <Download />
                Download Excel template
              </a>
            </Button>
            <FormError>{err}</FormError>
            <div
              className={`rounded-2xl border-[1.5px] border-dashed bg-panel p-6 text-center text-[13px] text-muted-foreground ${file ? "border-solid border-success/40 bg-success-soft/30" : ""}`}
            >
              <input
                ref={input}
                type="file"
                hidden
                accept=".xlsx"
                data-testid="file-input"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="size-4" />
                  <b className="text-foreground">{file.name}</b>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setFile(null);
                      setCheck(null);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 size-7 text-brand" />
                  <button
                    type="button"
                    className="font-bold text-brand-dark hover:underline"
                    onClick={() => input.current?.click()}
                  >
                    Choose an .xlsx file
                  </button>{" "}
                  (max 10 MB)
                </>
              )}
            </div>
            {file && checkM.isPending && !check && <Loading />}
            {file && check && <CheckPanel check={check} />}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="skip"
                  checked={skip}
                  onCheckedChange={(v) => setSkip(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="skip"
                  className="grid gap-0.5 text-[13px] font-semibold"
                >
                  <span>Skip duplicates</span>
                  <span className="font-normal text-muted-foreground">
                    Drawings already in the portal are skipped instead of
                    reported as errors. Keep this on when you import the same
                    Excel again after uploading missing files.
                  </span>
                </Label>
              </div>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="auto"
                  checked={auto}
                  onCheckedChange={(v) => setAuto(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="auto"
                  className="grid gap-0.5 text-[13px] font-semibold"
                >
                  <span>Create missing master data</span>
                  <span className="font-normal text-muted-foreground">
                    Unknown categories, makes, vehicle types, models, voltages,
                    Ah ratings and connectors are added automatically, so no row
                    is rejected for missing master data.
                  </span>
                </Label>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                disabled={
                  !file || running || start.isPending || checkM.isPending
                }
                onClick={() => start.mutate()}
              >
                <Upload />
                {check
                  ? `Import ${check.readyRows.toLocaleString()} drawing${check.readyRows === 1 ? "" : "s"}`
                  : "Start import"}
              </Button>
              {check && check.missingCount > 0 && (
                <span className="text-[13px] text-amber-700">
                  {check.missingCount.toLocaleString()} without a file will be
                  left out. Upload their files, then import this Excel again.
                </span>
              )}
              {running && (
                <span className="text-muted-foreground">
                  Another import is running…
                </span>
              )}
            </div>
          </Card2>
        </div>
        <Card2 className="p-5">
          <div className="mb-3 border-b pb-3 text-[13px] font-extrabold">
            Recent imports
          </div>
          {jobs.isLoading && <Loading />}
          {jobs.error && <ErrorState error={jobs.error} />}
          {jobs.data?.length === 0 && (
            <Empty icon={Layers} title="No imports yet" />
          )}
          {jobs.data?.map((j) => {
            const pct = j.totalRows
              ? Math.round((j.processedRows / j.totalRows) * 100)
              : j.status === "Completed"
                ? 100
                : 0;
            return (
              <motion.div
                key={j.id}
                layout
                className="border-b py-3 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold [overflow-wrap:anywhere]">
                    {j.fileName}
                  </span>
                  <span className="ml-auto">
                    <StatusBadge s={j.status} />
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {fmtDateTime(j.createdAtUtc)}
                </div>
                {(j.status === "Running" || j.status === "Queued") && (
                  <Progress
                    value={pct}
                    className="mt-2"
                    aria-label="Import progress"
                  />
                )}
                <div className="mt-2 text-muted-foreground">
                  {j.processedRows}/{j.totalRows} rows ·{" "}
                  <b className="text-[#2f6b25]">{j.createdCount} created</b> ·{" "}
                  {j.skippedCount} skipped ·{" "}
                  <b className={j.errorCount ? "text-destructive" : ""}>
                    {j.errorCount} errors
                  </b>
                </div>
                {j.failureMessage && (
                  <p className="mt-1 text-xs font-semibold text-destructive">
                    {j.failureMessage}
                  </p>
                )}
                {j.errorCount > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setShow(j)}
                  >
                    View errors
                  </Button>
                )}
              </motion.div>
            );
          })}
        </Card2>
      </div>
      {show && <ErrorsDialog job={show} onClose={() => setShow(null)} />}
    </>
  );
}

function ErrorsDialog({ job, onClose }: { job: BulkJob; onClose: () => void }) {
  const q = useQuery({
    queryKey: ["bulk-errors", job.id],
    queryFn: () => api.get<RowError[]>(`/api/bulk-import/${job.id}/errors`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Errors — {job.fileName}</DialogTitle>
          <DialogDescription>
            {q.data
              ? `${q.data.length.toLocaleString()} rows with problems. The list is virtualised, so thousands of rows stay fast.`
              : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <Loading />
        ) : (
          <div className="rounded-xl border">
            <VirtualTable columns={errCols} data={q.data ?? []} height={380} />
          </div>
        )}
        <DialogFooter>
          <Button asChild variant="outline">
            <a href={`/api/bulk-import/${job.id}/errors.csv`}>
              <Download />
              Download CSV
            </a>
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 border-b pb-3 text-[14px] font-extrabold">
      <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {n}
      </span>
      {title}
    </div>
  );
}

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

/** What the Excel looks like against the uploaded files: ready rows, rows still waiting for a file, problems. */
function CheckPanel({ check }: { check: BulkCheck }) {
  const downloadMissing = () => {
    const lines = [
      "Row,DrawingNumber,FileNameToUpload",
      ...check.missing.map((m) =>
        [m.rowNumber, m.drawingNumber, m.expectedFileName]
          .map(csvCell)
          .join(","),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "files-to-upload.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="mt-4 rounded-xl border p-4" data-testid="bulk-check">
      <div className="flex flex-wrap gap-2 text-[13px]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 font-bold text-[#2f6b25]">
          <Check className="size-3.5" />
          {check.readyRows.toLocaleString()} of{" "}
          {check.totalRows.toLocaleString()} rows have their file
        </span>
        {check.missingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 font-bold text-amber-800">
            <AlertTriangle className="size-3.5" />
            {check.missingCount.toLocaleString()} file
            {check.missingCount === 1 ? "" : "s"} missing
          </span>
        )}
        {check.invalidCount > 0 && (
          <span className="rounded-full bg-destructive/10 px-3 py-1 font-bold text-destructive">
            {check.invalidCount.toLocaleString()} row
            {check.invalidCount === 1 ? "" : "s"} with problems
          </span>
        )}
      </div>

      {check.missingCount > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-bold">
            Upload these files in step 1
            <Button
              size="sm"
              variant="outline"
              className="ml-auto"
              onClick={downloadMissing}
            >
              <Download />
              Download list
            </Button>
          </div>
          <div className="max-h-64 overflow-auto rounded-lg border">
            <table className="w-full text-left text-[13px]">
              <thead className="sticky top-0 bg-panel text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-1.5 font-semibold">Row</th>
                  <th className="px-3 py-1.5 font-semibold">Drawing no.</th>
                  <th className="px-3 py-1.5 font-semibold">
                    File name to upload
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {check.missing.map((m) => (
                  <tr key={m.rowNumber}>
                    <td className="px-3 py-1.5 font-mono">{m.rowNumber}</td>
                    <td className="px-3 py-1.5 font-mono">{m.drawingNumber}</td>
                    <td className="px-3 py-1.5 font-mono [overflow-wrap:anywhere]">
                      {m.expectedFileName}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {check.missingCount > check.missing.length && (
            <p className="mt-1 text-xs text-muted-foreground">
              Showing the first {check.missing.length} of{" "}
              {check.missingCount.toLocaleString()}. Download the list for
              these.
            </p>
          )}
        </div>
      )}

      {check.invalidCount > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[13px] font-bold">
            Rows to correct in the Excel
          </div>
          <ul className="max-h-40 divide-y overflow-auto rounded-lg border text-[13px]">
            {check.invalid.map((r) => (
              <li key={r.rowNumber} className="px-3 py-1.5">
                <span className="font-mono">Row {r.rowNumber}</span>
                {r.drawingNumber && (
                  <span className="font-mono"> · {r.drawingNumber}</span>
                )}{" "}
                <span className="text-destructive">{r.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {check.unusedCount > 0 && (
        <details className="mt-4 text-[13px]">
          <summary className="cursor-pointer font-semibold text-muted-foreground">
            {check.unusedCount.toLocaleString()} uploaded file
            {check.unusedCount === 1 ? "" : "s"} not used by any row
          </summary>
          <ul className="mt-1.5 max-h-32 overflow-auto font-mono text-xs text-muted-foreground">
            {check.unusedFiles.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}

      {check.missingCount === 0 && check.invalidCount === 0 && (
        <p className="mt-3 text-[13px] text-muted-foreground">
          Every row has its drawing file. You can import now.
        </p>
      )}
    </div>
  );
}