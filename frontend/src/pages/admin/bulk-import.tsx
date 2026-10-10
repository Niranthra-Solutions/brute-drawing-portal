import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Download, FileSpreadsheet, Layers, Upload } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api, postForm } from '@/lib/api'
import type { BulkJob } from '@/lib/types'
import { fmtDateTime } from '@/lib/util'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Advisory, Card2, Empty, ErrorState, FormError, Loading, PageHeader, StatusBadge, errMsg, notify } from '@/components/app/common'
import { VirtualTable } from '@/components/app/data-table'

interface RowError { rowNumber: number; drawingNumber: string | null; message: string }
const errCols: ColumnDef<RowError>[] = [
  { header: 'Row', meta: { className: 'w-20' }, cell: ({ row }) => <span className="font-mono">{row.original.rowNumber}</span> },
  { header: 'Drawing no.', meta: { className: 'w-40' }, cell: ({ row }) => <span className="font-mono">{row.original.drawingNumber ?? '—'}</span> },
  { header: 'Problem', cell: ({ row }) => row.original.message },
]

export default function BulkImportPage() {
  const qc = useQueryClient(); const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null); const [skip, setSkip] = useState(true); const [auto, setAuto] = useState(true); const [err, setErr] = useState(''); const [show, setShow] = useState<BulkJob | null>(null)
  const jobs = useQuery({ queryKey: ['bulk-jobs'], queryFn: () => api.get<BulkJob[]>('/api/bulk-import'), refetchInterval: q => (q.state.data?.some(j => j.status === 'Queued' || j.status === 'Running') ? 1500 : false) })
  const start = useMutation({
    mutationFn: () => { const fd = new FormData(); fd.append('file', file!); fd.append('skipDuplicates', String(skip)); fd.append('autoCreateMaster', String(auto)); return postForm<BulkJob>('/api/bulk-import', fd) },
    onSuccess: () => { setFile(null); setErr(''); qc.invalidateQueries({ queryKey: ['bulk-jobs'] }); notify.ok('Import queued — it runs in the background; you can keep working') }, onError: e => setErr(errMsg(e)),
  })
  const running = jobs.data?.some(j => j.status === 'Queued' || j.status === 'Running')
  // an import may have created makes/models/etc. - refresh the cached master data when a job finishes
  useEffect(() => { if (!running) qc.invalidateQueries({ queryKey: ['bootstrap'] }) }, [running, qc])
  return (
    <>
      <PageHeader eyebrow="Admin · Drawings" admin title="Bulk import from Excel" sub="Load hundreds or thousands of drawings at once. Each row carries the drawing's details and the URL generated when its file was uploaded." />
      <Advisory tone="blue" title="Drawing already uploaded?" className="mb-4">Open <Link to="/admin/files" className="font-medium underline">Uploaded files</Link>, copy the file's URL and paste it in the DrawingUrl column. The same URL can be used on as many rows as needed.</Advisory>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <Card2 className="p-5">
          <div className="mb-4 flex items-center gap-2 border-b pb-3 text-[13px] font-extrabold"><Layers className="size-4 text-brand-dark" />How it works</div>
          <ol className="mb-5 list-decimal space-y-1.5 pl-5 leading-relaxed"><li>Upload each drawing file on the <Link className="font-bold text-brand-dark underline" to="/admin/drawings/new">Upload drawing</Link> screen and copy its generated URL.</li><li>Download the template and add one row per drawing, pasting the URL into <b>DrawingUrl</b>.</li><li>Upload the Excel here. Rows are validated and inserted in the background; errors are listed per row.</li></ol>
          <Button asChild variant="outline" className="mb-6"><a href="/api/bulk-import/template"><Download />Download Excel template</a></Button>
          <FormError>{err}</FormError>
          <div className={`rounded-2xl border-[1.5px] border-dashed bg-panel p-6 text-center text-[13px] text-muted-foreground ${file ? 'border-solid border-success/40 bg-success-soft/30' : ''}`}>
            <input ref={input} type="file" hidden accept=".xlsx" data-testid="file-input" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            {file ? <div className="flex items-center justify-center gap-2"><FileSpreadsheet className="size-4" /><b className="text-foreground">{file.name}</b><Button size="sm" variant="ghost" onClick={() => setFile(null)}>Remove</Button></div>
              : <><Upload className="mx-auto mb-2 size-7 text-brand" /><button type="button" className="font-bold text-brand-dark hover:underline" onClick={() => input.current?.click()}>Choose an .xlsx file</button> (max 10 MB)</>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-2.5"><Checkbox id="skip" checked={skip} onCheckedChange={v => setSkip(v === true)} className="mt-0.5" /><Label htmlFor="skip" className="grid gap-0.5 text-[13px] font-semibold"><span>Skip duplicates</span><span className="font-normal text-muted-foreground">Existing drawing numbers are skipped instead of reported as errors.</span></Label></div>
            <div className="flex items-start gap-2.5"><Checkbox id="auto" checked={auto} onCheckedChange={v => setAuto(v === true)} className="mt-0.5" /><Label htmlFor="auto" className="grid gap-0.5 text-[13px] font-semibold"><span>Create missing master data</span><span className="font-normal text-muted-foreground">Unknown categories, makes, vehicle types, models, voltages, Ah ratings and connectors are added automatically, so no row is rejected for missing master data.</span></Label></div>
          </div>
          <div className="mt-6 flex items-center gap-3"><Button disabled={!file || running || start.isPending} onClick={() => start.mutate()}><Upload />Start import</Button>{running && <span className="text-muted-foreground">Another import is running…</span>}</div>
        </Card2>
        <Card2 className="p-5">
          <div className="mb-3 border-b pb-3 text-[13px] font-extrabold">Recent imports</div>
          {jobs.isLoading && <Loading />}{jobs.error && <ErrorState error={jobs.error} />}{jobs.data?.length === 0 && <Empty icon={Layers} title="No imports yet" />}
          {jobs.data?.map(j => { const pct = j.totalRows ? Math.round(j.processedRows / j.totalRows * 100) : j.status === 'Completed' ? 100 : 0
            return (
              <motion.div key={j.id} layout className="border-b py-3 last:border-0">
                <div className="flex items-center gap-2"><span className="font-bold [overflow-wrap:anywhere]">{j.fileName}</span><span className="ml-auto"><StatusBadge s={j.status} /></span></div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(j.createdAtUtc)}</div>
                {(j.status === 'Running' || j.status === 'Queued') && <Progress value={pct} className="mt-2" aria-label="Import progress" />}
                <div className="mt-2 text-muted-foreground">{j.processedRows}/{j.totalRows} rows · <b className="text-[#2f6b25]">{j.createdCount} created</b> · {j.skippedCount} skipped · <b className={j.errorCount ? 'text-destructive' : ''}>{j.errorCount} errors</b></div>
                {j.failureMessage && <p className="mt-1 text-xs font-semibold text-destructive">{j.failureMessage}</p>}
                {j.errorCount > 0 && <Button size="sm" variant="outline" className="mt-2" onClick={() => setShow(j)}>View errors</Button>}
              </motion.div>) })}
        </Card2>
      </div>
      {show && <ErrorsDialog job={show} onClose={() => setShow(null)} />}
    </>
  )
}

function ErrorsDialog({ job, onClose }: { job: BulkJob; onClose: () => void }) {
  const q = useQuery({ queryKey: ['bulk-errors', job.id], queryFn: () => api.get<RowError[]>(`/api/bulk-import/${job.id}/errors`) })
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader><DialogTitle>Errors — {job.fileName}</DialogTitle><DialogDescription>{q.data ? `${q.data.length.toLocaleString()} rows with problems. The list is virtualised, so thousands of rows stay fast.` : 'Loading…'}</DialogDescription></DialogHeader>
        {q.isLoading ? <Loading /> : <div className="rounded-xl border"><VirtualTable columns={errCols} data={q.data ?? []} height={380} /></div>}
        <DialogFooter><Button asChild variant="outline"><a href={`/api/bulk-import/${job.id}/errors.csv`}><Download />Download CSV</a></Button><Button onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}