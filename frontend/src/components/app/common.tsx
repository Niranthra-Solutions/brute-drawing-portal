import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { AlertTriangle, Check, Copy, Inbox, Loader2, RefreshCw } from 'lucide-react'
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiError } from '@/lib/api'
import { statusLabel } from '@/lib/util'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'

export const notify = { ok: (m: string) => toast.success(m), err: (m: string) => toast.error(m) }
export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.')

/** Maps API field errors onto react-hook-form fields. Returns a general message when no field matched. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, e: unknown, map: Record<string, string> = {}): string | undefined {
  if (!(e instanceof ApiError)) return errMsg(e)
  let matched = 0
  for (const [k, msg] of Object.entries(e.fields)) {
    const name = (map[k] ?? k) as Path<T>
    if (name in form.getValues() || map[k]) { form.setError(name, { type: 'server', message: msg }); matched++ }
  }
  return matched === 0 || Object.keys(e.fields).length === 0 ? e.message : undefined
}

const TONES = {
  green: 'bg-success-soft text-[#2f6b25]', amber: 'bg-warning-soft text-warning', red: 'bg-danger-soft text-destructive',
  orange: 'bg-brand-soft text-brand-dark', grey: 'bg-muted text-muted-foreground', blue: 'bg-info-soft text-info',
} as const
export type Tone = keyof typeof TONES
export function Pill({ tone = 'grey', dot = true, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return <Badge variant="secondary" className={cn('h-auto gap-1.5 rounded-full border-0 px-2.5 py-1 text-[11px] font-bold', TONES[tone], className)}>{dot && <span className="size-1.5 rounded-full bg-current" />}{children}</Badge>
}
const STATUS_TONE: Record<string, Tone> = { Submitted: 'amber', InReview: 'blue', Assigned: 'blue', InProgress: 'orange', Completed: 'green', Rejected: 'red', Active: 'green', Archived: 'grey', Queued: 'grey', Running: 'orange', CompletedWithErrors: 'amber', Failed: 'red' }
export const StatusBadge = ({ s }: { s: string }) => <Pill tone={STATUS_TONE[s] ?? 'grey'}>{s === 'CompletedWithErrors' ? 'Done · errors' : statusLabel(s)}</Pill>
export const PriorityBadge = ({ p }: { p: string }) => <Pill tone={p === 'Critical' ? 'red' : p === 'High' ? 'amber' : 'grey'} dot={false}>{p}</Pill>

export function PageHeader({ eyebrow, title, sub, actions, admin }: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode; admin?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <div className={cn('mb-2 inline-flex items-center gap-1.5 text-xs font-bold', admin ? 'text-brand-dark' : 'text-brand-dark')}><span className="size-1.5 rounded-full bg-current" />{eyebrow}</div>}
        <h1 className="mb-1 font-heading text-[27px] leading-tight font-bold tracking-tight">{title}</h1>
        {sub && <p className="max-w-[62ch] text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </motion.div>
  )
}

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={cn('size-4 animate-spin', className)} aria-label="Loading" />
export const Loading = ({ label = 'Loading…' }: { label?: string }) => <div className="flex items-center justify-center gap-3 p-16 text-muted-foreground"><Spinner className="size-5 text-brand" />{label}</div>

export function Empty({ icon: Icon = Inbox, title, children, action }: { icon?: typeof Inbox; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-12 text-center text-muted-foreground">
      <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-muted"><Icon className="size-6" /></div>
      <h3 className="mb-1 text-[15px] font-bold text-foreground">{title}</h3>
      {children && <div className="mx-auto max-w-md text-sm">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export const ErrorState = ({ error, onRetry }: { error: unknown; onRetry?: () => void }) => (
  <Empty icon={AlertTriangle} title="Something went wrong" action={onRetry && <Button variant="outline" onClick={onRetry}><RefreshCw />Try again</Button>}>{errMsg(error)}</Empty>
)
export const FormError = ({ children }: { children?: ReactNode }) => children ? (
  <Alert variant="destructive" className="mb-4 border-destructive/30 bg-danger-soft"><AlertTriangle /><AlertTitle className="text-destructive">{children}</AlertTitle></Alert>
) : null

export function Advisory({ tone = 'amber', icon: Icon = AlertTriangle, title, children, className }: { tone?: 'amber' | 'blue' | 'green'; icon?: typeof Inbox; title: string; children?: ReactNode; className?: string }) {
  const t = { amber: 'bg-warning-soft text-[#7a5b0a]', blue: 'bg-info-soft text-[#2f458e]', green: 'bg-success-soft text-[#2f5f26]' }[tone]
  return <div className={cn('mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3.5 text-[13px]', t, className)}><Icon className="mt-0.5 size-4 shrink-0" /><div><b className="block text-[13.5px]">{title}</b>{children}</div></div>
}

export function ConfirmDialog({ open, onOpenChange, title, message, confirmLabel = 'Confirm', danger, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => Promise<unknown> | void }) {
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription asChild><div>{message}</div></AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant={danger ? 'destructive' : 'default'} disabled={busy} onClick={async () => { setBusy(true); try { await onConfirm(); onOpenChange(false) } catch { /* caller shows the error */ } finally { setBusy(false) } }}>{busy && <Spinner />}{confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function CopyField({ value, label = 'URL' }: { value: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} aria-label={label} className="font-mono text-xs" onFocus={e => e.currentTarget.select()} />
      <Button type="button" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); notify.ok('Copied to clipboard'); setTimeout(() => setDone(false), 1800) } catch { notify.err('Copy failed — select the text and press Ctrl+C') } }}>
        {done ? <Check /> : <Copy />}Copy
      </Button>
    </div>
  )
}

export const Card2 = ({ className, children }: { className?: string; children: ReactNode }) => <div className={cn('rounded-2xl border bg-card shadow-[0_10px_24px_-22px_rgba(23,26,30,.12)]', className)}>{children}</div>
export const SectionCard = ({ icon: Icon, title, children, className }: { icon?: typeof Inbox; title: string; children: ReactNode; className?: string }) => (
  <Card2 className={cn('mb-4 p-5', className)}>
    <div className="mb-4 flex items-center gap-2 border-b pb-3 text-[13px] font-extrabold">{Icon && <Icon className="size-4 text-brand-dark" />}{title}</div>
    {children}
  </Card2>
)
export const SpecRow = ({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) => children == null || children === '' ? null : (
  <div className="flex justify-between gap-3 py-1.5 text-[13.5px]"><span className="text-muted-foreground">{label}</span><span className={cn('text-right font-semibold [overflow-wrap:anywhere]', mono && 'font-mono')}>{children}</span></div>
)
export const SpecCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <Card2 className="mb-3.5 p-5"><div className="mb-2.5 border-b pb-2.5 text-[11.5px] font-bold tracking-wide text-muted-foreground uppercase">{title}</div>{children}</Card2>
)
