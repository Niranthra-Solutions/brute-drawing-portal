import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts'
import { Check, Clock, Database, FolderOpen, Hash, Inbox, Pencil, Plus, Search, type LucideIcon } from 'lucide-react'
import { api } from '@/lib/api'
import type { Dashboard } from '@/lib/types'
import { ago } from '@/lib/util'
import { useAuth } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card2, Empty, ErrorState, Loading, PageHeader, PriorityBadge, StatusBadge } from '@/components/app/common'
import { cn } from '@/lib/utils'

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

function Stat({ label, value, foot, icon: Icon, tone, hero, warn }: { label: string; value: React.ReactNode; foot: string; icon: LucideIcon; tone: string; hero?: boolean; warn?: boolean }) {
  return (
    <motion.div variants={item}><Card2 className={cn('flex min-h-32 flex-col justify-between p-[18px]', hero && 'p-[22px]')}>
      <div className="flex items-center justify-between"><span className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{label}</span><span className={cn('flex size-[30px] items-center justify-center rounded-[9px]', tone)}><Icon className="size-4" /></span></div>
      <div className={cn('font-heading font-bold tracking-tight', hero ? 'text-[34px]' : 'text-[25px]')}>{value}</div>
      <div className={cn('text-xs font-semibold', warn ? 'text-destructive' : 'text-muted-foreground')}>{foot}</div>
    </Card2></motion.div>
  )
}

export default function DashboardPage() {
  const user = useAuth(s => s.user); const nav = useNavigate(); const admin = user?.role === 'Admin'
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/api/dashboard') })
  if (q.isLoading) return <Loading />
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const d = q.data, r = d.requests
  const pie = [{ name: 'Open', value: r.open, c: '#4c6fd9' }, { name: 'In progress', value: r.inProgress, c: '#e06a2c' }, { name: 'Completed', value: r.completed, c: '#5fa850' }, { name: 'Rejected', value: r.rejected, c: '#d8432f' }].filter(x => x.value > 0)
  return (
    <>
      <PageHeader eyebrow={admin ? 'Admin' : 'User'} title={`Welcome back, ${user?.fullName.split(' ')[0]}`} sub={admin ? 'Manage drawings, respond to requests and keep master data current.' : 'Find the right battery tray drawing in seconds, or raise a request if it does not exist yet.'} />
      <motion.div variants={container} initial="hidden" animate="show">
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {([['/search', Search, 'Drawing search', 'Search by vehicle, battery and tray dimensions. Get the exact drawing or the closest standard alternatives.'], ['/search-by-number', Hash, 'Search by drawing number', 'Know the number already? Jump straight to the drawing and its revision history.']] as const).map(([to, Icon, title, text]) => (
            <motion.button key={to} variants={item} whileHover={{ y: -2 }} onClick={() => nav(to)} className="flex w-full items-center gap-[18px] rounded-[20px] border bg-card p-6 text-left transition-shadow hover:border-brand hover:shadow-[0_18px_40px_-26px_rgba(224,106,44,.7)]">
              <span className="flex size-[76px] shrink-0 items-center justify-center rounded-[20px] bg-brand-soft text-brand-dark"><Icon className="size-8" /></span>
              <span><h3 className="mb-1 font-heading text-[17px] font-bold">{title}</h3><span className="text-muted-foreground">{text}</span></span>
            </motion.button>))}
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <Stat hero label={admin ? 'Drawings in library' : 'Drawings available'} value={d.totalDrawings.toLocaleString()} foot={`+${d.addedThisWeek} added this week`} icon={Database} tone="bg-brand-soft text-brand-dark" />
          <Stat label={admin ? 'Open requests' : 'My open requests'} value={r.open + r.inProgress} foot={r.criticalOpen ? `${r.criticalOpen} critical` : 'None critical'} warn={r.criticalOpen > 0} icon={Inbox} tone="bg-info-soft text-info" />
          <Stat label="Completed (30 d)" value={r.completed30Days} foot={`${r.completed} all-time`} icon={Check} tone="bg-success-soft text-[#2f6b25]" />
          <Stat label="Avg turnaround" value={<>{r.avgTurnaroundDays}<span className="text-sm"> d</span></>} foot="submitted → drawing" icon={Clock} tone="bg-muted text-muted-foreground" />
        </div>
      </motion.div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <Card2 className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4"><div className="flex items-center gap-2 text-[15px] font-extrabold">{admin ? 'Latest requests' : 'My recent requests'}<span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{r.total}</span></div><Button asChild variant="outline" size="sm"><Link to="/requests">View all</Link></Button></div>
          {d.recent.length === 0 ? <Empty title="No requests yet" action={!admin && <Button asChild><Link to="/requests/new"><Plus />Raise a request</Link></Button>}>Requests you raise will appear here with live status.</Empty> : (
            <Table><TableHeader className="bg-panel"><TableRow className="hover:bg-transparent">{['Ticket', 'Request', 'Status', 'Updated'].map(h => <TableHead key={h} className="h-10 px-4 text-[10.5px] font-bold tracking-wider text-muted-foreground uppercase">{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{d.recent.map(x => <TableRow key={x.id} className="cursor-pointer" onClick={() => nav(`/requests/${x.id}`)}>
                <TableCell className="px-4 py-3"><span className="font-mono text-[12.5px] font-semibold text-brand-dark">{x.ticketNo}</span></TableCell>
                <TableCell className="px-4 py-3"><div className="font-bold">{x.title}</div><div className="flex items-center gap-2 text-xs text-muted-foreground">{admin ? x.requestedByName : x.type === 'New' ? 'New drawing' : 'Modification'}<PriorityBadge p={x.priority} /></div></TableCell>
                <TableCell className="px-4 py-3"><StatusBadge s={x.status} /></TableCell><TableCell className="px-4 py-3 text-muted-foreground">{ago(x.updatedAtUtc)}</TableCell></TableRow>)}</TableBody></Table>)}
        </Card2>
        <div className="grid gap-4">
          {pie.length > 0 && <Card2 className="p-5"><div className="mb-2 border-b pb-3 text-[13px] font-extrabold">Requests by status</div>
            <div className="flex items-center gap-3"><div className="size-[130px] shrink-0"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={38} outerRadius={60} paddingAngle={3} stroke="none">{pie.map(p => <Cell key={p.name} fill={p.c} />)}</Pie><RTooltip /></PieChart></ResponsiveContainer></div>
              <ul className="grid gap-1.5 text-xs">{pie.map(p => <li key={p.name} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: p.c }} />{p.name}<b className="ml-auto pl-3">{p.value}</b></li>)}</ul></div></Card2>}
          {admin ? (
            <>
              <Card2 className="p-5"><div className="mb-2 border-b pb-3 text-[13px] font-extrabold">Turnaround by week (days)</div>
                <div className="h-36"><ResponsiveContainer><BarChart data={d.turnaround} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#eee9df" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} /><RTooltip cursor={{ fill: '#f3f1ec' }} formatter={(v, _n, p) => [`${v} d · ${p.payload.closed} closed`, 'Avg']} /><Bar dataKey="avgDays" radius={[6, 6, 0, 0]}>{d.turnaround.map((_, i) => <Cell key={i} fill={i === d.turnaround.length - 1 ? '#e06a2c' : '#e9d6c8'} />)}</Bar></BarChart></ResponsiveContainer></div></Card2>
              <Card2 className="p-5"><div className="mb-2 border-b pb-3 text-[13px] font-extrabold">Recent activity</div>
                {d.activity.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
                {d.activity.map(a => <div key={a.id} className="flex gap-3 border-b py-2.5 last:border-0"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" /><div><div className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{ago(a.createdAtUtc)} · {a.actorEmail}</div><div className="text-[13px] [overflow-wrap:anywhere]">{a.summary}</div></div></div>)}</Card2>
            </>
          ) : (
            <Card2 className="p-5"><div className="mb-3 border-b pb-3 text-[13px] font-extrabold">Quick actions</div>
              {([['/requests/new', Plus, 'Request a new drawing'], ['/requests/modify', Pencil, 'Request a drawing modification'], ['/search', Search, 'Search by vehicle & dimensions'], ['/documents', FolderOpen, 'Browse documents & training']] as const).map(([to, Icon, t]) => <Link key={to} to={to} className="mb-2.5 flex items-center gap-3 rounded-[13px] border p-3 text-[13.5px] font-bold hover:border-input hover:bg-panel"><span className="flex size-[34px] items-center justify-center rounded-[10px] bg-brand-soft text-brand-dark"><Icon className="size-4" /></span>{t}</Link>)}</Card2>
          )}
        </div>
      </div>
    </>
  )
}