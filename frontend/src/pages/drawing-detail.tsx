import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Download, FileText, Pencil, Trash2, Upload } from 'lucide-react'
import { api } from '@/lib/api'
import type { DrawingDetail } from '@/lib/types'
import { fileUrl, fmtDate, fmtDateTime, fmtSize } from '@/lib/util'
import { useIsAdmin } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card2, ConfirmDialog, ErrorState, Loading, PageHeader, Pill, SpecCard, SpecRow, StatusBadge, errMsg, notify } from '@/components/app/common'

export default function DrawingDetailPage() {
  const { id = '' } = useParams(); const nav = useNavigate(); const admin = useIsAdmin(); const qc = useQueryClient()
  const q = useQuery({ queryKey: ['drawing', id], queryFn: () => api.get<DrawingDetail>(`/api/drawings/${id}`), retry: false })
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null)
  const status = useMutation({
    mutationFn: (s: 'Active' | 'Archived') => { const d = q.data!.drawing; return api.put(`/api/drawings/${id}`, { drawingNumber: d.drawingNumber, modelId: d.modelId, voltageV: d.voltageV, ahValue: d.ahValue, ahStandard: d.ahStandard, lengthMm: d.lengthMm, widthMm: d.widthMm, heightMm: d.heightMm, connectorTypeId: d.connectorId, comments: d.comments, competitorDrawingNumber: d.competitorDrawingNumber, status: s }) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drawing', id] }); qc.invalidateQueries({ queryKey: ['drawings'] }); notify.ok('Drawing updated') }, onError: e => notify.err(errMsg(e)),
  })
  if (q.isLoading) return <Loading />
  if (q.error || !q.data) return <ErrorState error={q.error} />
  const { drawing: d, revisions, file } = q.data
  return (
    <>
      <PageHeader eyebrow={`${d.category} · ${d.vehicleType}`} admin={admin} title={d.drawingNumber} sub={`${d.make} ${d.model} · ${d.capacity} · ${d.voltageV} V · ${d.ah} Ah`}
        actions={<>
          {file && <Button asChild><a href={fileUrl(file.id)}><Download />Download</a></Button>}
          {!admin && <Button asChild variant="outline"><Link to={`/requests/modify?drawingId=${d.id}`}><Pencil />Request modification</Link></Button>}
          {admin && <>
            <Button asChild variant="outline"><Link to={`/admin/drawings/${d.id}/revision`}><Upload />Upload revision</Link></Button>
            <Button asChild variant="outline"><Link to={`/admin/drawings/${d.id}/edit`}><Pencil />Edit</Link></Button>
            <Button variant="outline" onClick={() => (d.status === 'Active' ? setConfirm('archive') : status.mutate('Active'))}>{d.status === 'Active' ? <Archive /> : <ArchiveRestore />}{d.status === 'Active' ? 'Archive' : 'Restore'}</Button>
            <Button variant="destructive" onClick={() => setConfirm('delete')}><Trash2 />Delete</Button></>}
        </>} />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_330px]">
        <div className="grid gap-4">
          <Card2 className="p-5">
            <div className="mb-4 flex items-center gap-2"><StatusBadge s={d.status} /><Pill tone="green" dot={false}>Revision {d.revisionLabel}</Pill><span className="ml-auto text-xs text-muted-foreground">Updated {fmtDate(d.updatedAtUtc)}</span></div>
            <div className="corners relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-2xl border bg-panel">
              {file?.canPreview ? (/\.pdf$/i.test(file.name)
                ? <iframe title={`Preview of ${d.drawingNumber}`} src={fileUrl(file.id, true) + '#view=FitH'} className="h-[560px] w-full border-0 bg-white" />
                : <img alt={`Drawing ${d.drawingNumber}`} src={fileUrl(file.id, true)} className="max-h-[560px] max-w-full" />)
                : <div className="p-8 text-center text-muted-foreground"><FileText className="mx-auto size-9" /><div className="mt-2 font-bold text-foreground">Preview not available for this file type</div><div>Download the file to open it in your CAD viewer.</div></div>}
            </div>
            {file?.canPreview && <a className="mt-2 inline-block text-[13px] font-bold text-brand-dark" href={fileUrl(file.id, true)} target="_blank" rel="noreferrer">Open full screen ↗</a>}
          </Card2>
          <Card2 className="overflow-hidden">
            <div className="flex items-center gap-2 border-b px-5 py-4 text-[15px] font-extrabold">Revision history<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{revisions.length}</span></div>
            <Table><TableHeader className="bg-panel"><TableRow className="hover:bg-transparent">{['Rev', 'Drawing no.', 'Change', 'By', 'Date', ''].map(h => <TableHead key={h} className="h-10 px-4 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{revisions.map(r => <TableRow key={r.id}>
                <TableCell className="px-4"><Pill tone={r.isCurrent ? 'green' : 'grey'} dot={false}>{r.label}{r.isCurrent ? ' · current' : ''}</Pill></TableCell>
                <TableCell className="px-4 font-mono text-[12.5px] font-semibold text-brand-dark">{r.drawingNumber}</TableCell>
                <TableCell className="px-4 whitespace-normal">{r.changeNotes ?? '—'}{r.requestTicketNo && <div className="text-xs text-muted-foreground">Request <span className="font-mono text-brand-dark">{r.requestTicketNo}</span></div>}</TableCell>
                <TableCell className="px-4">{r.createdByName ?? '—'}</TableCell><TableCell className="px-4 text-muted-foreground">{fmtDateTime(r.createdAtUtc)}</TableCell>
                <TableCell className="px-4 text-right">{r.fileId && <Button asChild variant="outline" size="icon-sm"><a href={fileUrl(r.fileId)} aria-label={`Download revision ${r.label}`}><Download /></a></Button>}</TableCell></TableRow>)}</TableBody></Table>
          </Card2>
        </div>
        <div>
          <SpecCard title="Vehicle"><SpecRow label="Category">{d.category}</SpecRow><SpecRow label="Make">{d.make}</SpecRow><SpecRow label="Type">{d.vehicleType}</SpecRow><SpecRow label="Model">{d.model}</SpecRow><SpecRow label="Capacity">{d.capacity}</SpecRow></SpecCard>
          <SpecCard title="Battery & tray"><SpecRow label="Voltage">{d.voltageV} V</SpecRow><SpecRow label="Ah rating">{d.ah}</SpecRow><SpecRow label="Length" mono>{d.lengthMm} mm</SpecRow><SpecRow label="Width" mono>{d.widthMm} mm</SpecRow><SpecRow label="Height" mono>{d.heightMm} mm</SpecRow><SpecRow label="End connector">{d.connector}</SpecRow></SpecCard>
          <SpecCard title="Reference"><SpecRow label="Competitor drawing" mono>{d.competitorDrawingNumber ?? '—'}</SpecRow><SpecRow label="Comments">{d.comments ?? '—'}</SpecRow></SpecCard>
          {file && <SpecCard title="File"><SpecRow label="Name">{file.name}</SpecRow><SpecRow label="Size">{fmtSize(file.sizeBytes)}</SpecRow><SpecRow label="Uploaded">{fmtDate(file.createdAtUtc)}</SpecRow>{admin && <SpecRow label="SHA-256" mono>{file.sha256.slice(0, 12)}…</SpecRow>}</SpecCard>}
        </div>
      </div>
      <ConfirmDialog open={confirm === 'delete'} onOpenChange={o => !o && setConfirm(null)} danger title="Delete drawing?" confirmLabel="Delete" message={<>Delete <b>{d.drawingNumber}</b>? It is removed from search and the library (an audit record is kept).</>}
        onConfirm={async () => { await api.del(`/api/drawings/${id}`); notify.ok('Drawing deleted'); qc.invalidateQueries({ queryKey: ['drawings'] }); nav('/admin/drawings') }} />
      <ConfirmDialog open={confirm === 'archive'} onOpenChange={o => !o && setConfirm(null)} title="Archive drawing?" confirmLabel="Archive" message="Archived drawings are hidden from Marketing search and suggestions but kept for history. You can restore it any time." onConfirm={() => status.mutateAsync('Archived')} />
    </>
  )
}
