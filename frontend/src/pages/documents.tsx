import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Download, Eye, FolderOpen, Pencil, Search, Trash2, Upload } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { api } from '@/lib/api'
import type { DocumentItem, Paged, UploadedFile } from '@/lib/types'
import { fileUrl, fmtDate, fmtSize } from '@/lib/util'
import { documentSchema } from '@/lib/schemas'
import { useDebounced } from '@/lib/hooks'
import { useIsAdmin } from '@/stores/auth'
import { prefs } from '@/lib/cookies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form } from '@/components/ui/form'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card2, ConfirmDialog, Empty, ErrorState, FormError, PageHeader, Pill, Spinner, applyServerErrors, notify } from '@/components/app/common'
import { DataTable } from '@/components/app/data-table'
import { FilterSelect, FInput, FTextarea } from '@/components/app/fields'
import { FileUpload } from '@/components/app/file-upload'

export default function DocumentsPage() {
  const admin = useIsAdmin(); const qc = useQueryClient()
  const [f, setF] = useState({ q: '', category: '', page: 1, pageSize: prefs.pageSize(20) }); const q = useDebounced(f.q)
  const [edit, setEdit] = useState<DocumentItem | 'new' | null>(null); const [del, setDel] = useState<DocumentItem | null>(null)
  const list = useQuery({ queryKey: ['documents', { ...f, q }], queryFn: () => api.get<Paged<DocumentItem>>('/api/documents', { q, category: f.category, page: f.page, pageSize: f.pageSize }), placeholderData: keepPreviousData })
  const cats = useQuery({ queryKey: ['doc-cats'], queryFn: () => api.get<string[]>('/api/documents/categories') })
  const done = () => { qc.invalidateQueries({ queryKey: ['documents'] }); qc.invalidateQueries({ queryKey: ['doc-cats'] }) }
  const columns: ColumnDef<DocumentItem>[] = [
    { header: 'Document', cell: ({ row: { original: d } }) => <><div className="font-bold">{d.title}</div><div className="text-xs text-muted-foreground">{d.description ?? d.fileName}</div></> },
    { header: 'Category', cell: ({ row }) => <Pill dot={false}>{row.original.category}</Pill> },
    { header: 'Type', cell: ({ row }) => <span className="font-mono text-muted-foreground">{row.original.extension.replace('.', '').toUpperCase()}</span> },
    { header: 'Size', cell: ({ row }) => <span className="text-muted-foreground">{fmtSize(row.original.sizeBytes)}</span> },
    { header: 'Updated', cell: ({ row }) => <span className="text-muted-foreground">{fmtDate(row.original.createdAtUtc)}</span> },
    { id: 'a', header: '', meta: { className: 'text-right' }, cell: ({ row: { original: d } }) => (
      <div className="flex justify-end gap-1.5">
        {d.canPreview && <Button asChild variant="outline" size="icon-sm"><a href={fileUrl(d.fileId, true)} target="_blank" rel="noreferrer" aria-label={`View ${d.title}`}><Eye /></a></Button>}
        <Button asChild variant="outline" size="icon-sm"><a href={fileUrl(d.fileId)} aria-label={`Download ${d.title}`}><Download /></a></Button>
        {admin && <><Button variant="outline" size="icon-sm" onClick={() => setEdit(d)} aria-label={`Edit ${d.title}`}><Pencil /></Button><Button variant="destructive" size="icon-sm" onClick={() => setDel(d)} aria-label={`Delete ${d.title}`}><Trash2 /></Button></>}
      </div>) },
  ]
  return (
    <>
      <PageHeader eyebrow="Documents" admin={admin} title="Document library" sub="Manuals, presentations, brochures, training videos and pictures for Motive Power." actions={admin && <Button onClick={() => setEdit('new')}><Upload />Add document</Button>} />
      <Card2 className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div className="relative w-full max-w-xs"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input value={f.q} onChange={e => setF({ ...f, q: e.target.value, page: 1 })} placeholder="Search documents" aria-label="Search documents" className="h-9 pl-9" /></div>
          <FilterSelect label="Category" className="w-44" value={f.category} onChange={v => setF({ ...f, category: v, page: 1 })} placeholder="All categories" options={(cats.data ?? []).map(c => ({ value: c, label: c }))} />
        </div>
        {list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : <DataTable columns={columns} data={list.data?.items ?? []} loading={list.isLoading} rowKey={d => d.id} page={f.page} pageSize={f.pageSize} total={list.data?.total ?? 0}
          onPage={p => setF({ ...f, page: p })} onPageSize={n => { prefs.setPageSize(n); setF({ ...f, pageSize: n, page: 1 }) }} empty={<Empty icon={FolderOpen} title="No documents found">Try a different search or category.</Empty>} />}
      </Card2>
      {edit && <DocDialog doc={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); done(); notify.ok('Document saved') }} />}
      <ConfirmDialog open={!!del} onOpenChange={o => !o && setDel(null)} danger title="Delete document?" confirmLabel="Delete" message={<>Delete <b>{del?.title}</b> from the library?</>} onConfirm={async () => { await api.del(`/api/documents/${del!.id}`); done(); notify.ok('Document deleted') }} />
    </>
  )
}

function DocDialog({ doc, onClose, onSaved }: { doc: DocumentItem | null; onClose: () => void; onSaved: () => void }) {
  const form = useForm({ resolver: zodResolver(documentSchema), defaultValues: { title: doc?.title ?? '', category: doc?.category ?? 'General', description: doc?.description ?? '' } })
  const [file, setFile] = useState<UploadedFile | null>(null); const [err, setErr] = useState('')
  const save = form.handleSubmit(async v => {
    if (!doc && !file) { setErr('Upload the document file first.'); return }
    setErr('')
    try { const body = { ...v, fileId: file?.id }; if (doc) await api.put(`/api/documents/${doc.id}`, body); else await api.post('/api/documents', body); onSaved() } catch (e) { setErr(applyServerErrors(form, e) ?? '') }
  })
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{doc ? 'Edit document' : 'Add document'}</DialogTitle><DialogDescription className="sr-only">Document details</DialogDescription></DialogHeader>
        <FormError>{err}</FormError>
        <Form {...form}><form onSubmit={save} className="grid gap-4" noValidate>
          <FileUpload endpoint="/api/files/documents" accept=".pdf,.pptx,.ppt,.docx,.doc,.xlsx,.xls,.mp4,.png,.jpg,.jpeg" hint="PDF, PowerPoint, Word, Excel, MP4, JPG, PNG · up to 200 MB" value={file} onUploaded={setFile} onCleared={() => setFile(null)} compact />
          {doc && !file && <p className="-mt-2 text-xs text-muted-foreground">Current file: {doc.fileName}. Upload a new file only to replace it.</p>}
          <div className="grid gap-4 sm:grid-cols-2"><FInput control={form.control} name="title" label="Title" required maxLength={200} /><FInput control={form.control} name="category" label="Category" required maxLength={80} /></div>
          <FTextarea control={form.control} name="description" label="Description" maxLength={1000} />
          <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting && <Spinner />}Save</Button></DialogFooter>
        </form></Form>
      </DialogContent>
    </Dialog>
  )
}
