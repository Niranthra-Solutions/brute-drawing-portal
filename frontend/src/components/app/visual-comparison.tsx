import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, ExternalLink, FileText, Maximize2 } from 'lucide-react'
import { api } from '@/lib/api'
import type { Drawing, DrawingDetail, RequestDetail, Revision } from '@/lib/types'
import { fileUrl } from '@/lib/util'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SectionCard } from './common'

interface Item { key: string; fileId: string | null; name: string; canPreview: boolean; caption: string; to?: string }
interface Pane { badge: string; tone: 'grey' | 'orange' | 'green'; items: Item[]; placeholder: string }

const TONE = { grey: 'bg-white/15 text-white', orange: 'bg-brand text-white', green: 'bg-success text-white' } as const

const drawingItem = (d: Drawing, caption: string): Item => ({ key: 'd-' + d.id, fileId: d.fileId, name: d.fileName ?? d.drawingNumber, canPreview: d.canPreview, caption: `${caption} · ${d.drawingNumber}`, to: `/drawings/${d.id}` })

/** Builds the two panes from the request: CURRENT drawing vs requested MARKUP, which becomes the REVISED drawing once Engineering completes it. */
export function buildPanes(r: RequestDetail, before?: Revision): [Pane, Pane] | null {
  const marks: Item[] = r.attachments.map(a => ({ key: 'a-' + a.fileId, fileId: a.fileId, name: a.name, canPreview: a.canPreview, caption: a.name }))
  const base = r.relatedDrawing
  if (!base && !r.resultDrawing) return null
  const left: Pane = base && before
    ? { badge: `BEFORE: REV ${before.label}`, tone: 'grey', items: [{ key: 'rev-' + before.id, fileId: before.fileId, name: before.fileName ?? before.drawingNumber, canPreview: /\.(pdf|png|jpe?g)$/i.test(before.fileName ?? ''), caption: `Rev ${before.label} · ${before.drawingNumber}`, to: `/drawings/${base.id}` }], placeholder: 'Previous drawing render' }
    : base
    ? { badge: `CURRENT: REV ${base.revisionLabel}`, tone: 'grey', items: [drawingItem(base, `Rev ${base.revisionLabel}`)], placeholder: 'Current drawing render' }
    : { badge: 'REFERENCE', tone: 'grey', items: marks, placeholder: 'Requester reference' }
  const revised = r.resultDrawing ? [drawingItem(r.resultDrawing, `Rev ${r.resultDrawing.revisionLabel}`)] : []
  const right: Pane = r.resultDrawing
    ? { badge: `REVISED: REV ${r.resultDrawing.revisionLabel}`, tone: 'green', items: base ? [...revised, ...marks] : revised, placeholder: 'Revised drawing' }
    : { badge: marks.length ? `MARKUP: ${marks.length === 1 ? 'RECEIVED' : marks.length + ' FILES'}` : 'MARKUP: PENDING', tone: 'orange', items: base ? marks : [], placeholder: 'Proposed markup render' }
  return [left, right]
}

function Preview({ item, className }: { item?: Item; className?: string }) {
  if (!item) return null
  if (item.fileId && item.canPreview) return /\.pdf$/i.test(item.name)
    ? <iframe title={item.caption} src={fileUrl(item.fileId, true) + '#toolbar=0&view=FitH'} className={cn('size-full border-0 bg-white', className)} />
    : <img alt={item.caption} src={fileUrl(item.fileId, true)} className={cn('size-full object-contain', className)} />
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white/60">
      <FileText className="size-8" /><div className="font-semibold text-white/80 [overflow-wrap:anywhere]">{item.name}</div><div>No in-browser preview for this file type.</div>
      {item.fileId && <Button asChild size="sm" variant="secondary"><a href={fileUrl(item.fileId)}><Download />Download</a></Button>}
    </div>
  )
}

function PaneView({ pane, big, onExpand }: { pane: Pane; big?: boolean; onExpand?: () => void }) {
  const [i, setI] = useState(0)
  const item = pane.items[Math.min(i, pane.items.length - 1)]
  return (
    <div>
      <div className={cn('group corners relative overflow-hidden rounded-2xl bg-[#1f2024]', big ? 'h-[70vh]' : 'h-[260px]')}>
        <span className="pointer-events-none absolute right-2.5 top-2.5 z-[2] size-4 border-t-2 border-r-2 border-brand/60" /><span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[2] size-4 border-b-2 border-l-2 border-brand/60" />
        <div className="absolute inset-0"><AnimatePresence mode="wait"><motion.div key={item?.key ?? 'empty'} className="size-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
          {item ? <Preview item={item} /> : <div className="flex size-full items-center justify-center text-sm text-white/40">{pane.placeholder}</div>}
        </motion.div></AnimatePresence></div>
        <span className={cn('absolute top-3 left-4 z-[3] rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wide backdrop-blur', TONE[pane.tone])}>{pane.badge}</span>
        {onExpand && item && <Button variant="secondary" size="icon-sm" className="absolute right-4 bottom-3 z-[3] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100" onClick={onExpand} aria-label={`Expand ${pane.badge}`}><Maximize2 /></Button>}
      </div>
      <div className="mt-2 flex min-h-8 flex-wrap items-center gap-1.5">
        {pane.items.length > 1 && pane.items.map((it, n) => (
          <button key={it.key} type="button" onClick={() => setI(n)} className={cn('max-w-[190px] truncate rounded-full border px-2.5 py-1 text-[11.5px] font-semibold', n === i ? 'border-brand bg-brand-soft text-brand-dark' : 'text-muted-foreground hover:bg-muted')}>{it.caption}</button>))}
        {pane.items.length === 1 && <span className="truncate text-xs text-muted-foreground">{item?.caption}</span>}
        <span className="ml-auto flex gap-1.5">
          {item?.to && <Button asChild variant="ghost" size="xs"><Link to={item.to}><ExternalLink />Open</Link></Button>}
          {item?.fileId && <Button asChild variant="ghost" size="xs"><a href={fileUrl(item.fileId)}><Download />Download</a></Button>}
        </span>
      </div>
    </div>
  )
}

export function VisualComparison({ r }: { r: RequestDetail }) {
  // Once completed as a REVISION of the same drawing, the left panel must show the version from BEFORE that revision (not the new one).
  const sameDrawing = !!r.resultDrawing && !!r.relatedDrawing && r.resultDrawing.id === r.relatedDrawing.id
  const history = useQuery({ queryKey: ['drawing', r.relatedDrawing?.id], queryFn: () => api.get<DrawingDetail>(`/api/drawings/${r.relatedDrawing!.id}`), enabled: sameDrawing, retry: false })
  const before = useMemo(() => { const revs = history.data?.revisions ?? []; const i = revs.findIndex(x => x.requestTicketNo === r.ticketNo); return i >= 0 ? revs[i + 1] : undefined }, [history.data, r.ticketNo])
  const panes = useMemo(() => buildPanes(r, before), [r, before])
  const [open, setOpen] = useState(false)
  if (!panes) return null
  return (
    <>
      <SectionCard icon={Maximize2} title="Visual comparison">
        <div className="grid gap-4 md:grid-cols-2"><PaneView pane={panes[0]} onExpand={() => setOpen(true)} /><PaneView pane={panes[1]} onExpand={() => setOpen(true)} /></div>
      </SectionCard>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[min(1400px,96vw)]">
          <DialogHeader><DialogTitle>Visual comparison · {r.ticketNo}</DialogTitle><DialogDescription>{panes[0].badge} vs {panes[1].badge}</DialogDescription></DialogHeader>
          <div className="grid gap-4 lg:grid-cols-2"><PaneView pane={panes[0]} big /><PaneView pane={panes[1]} big /></div>
        </DialogContent>
      </Dialog>
    </>
  )
}
