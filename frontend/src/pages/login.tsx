import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { prefs } from '@/lib/cookies'
import { emailSchema } from '@/lib/schemas'
import { useAuth } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FInput } from '@/components/app/fields'
import { FormError, Spinner, errMsg } from '@/components/app/common'
import { cn } from '@/lib/utils'
import { PoweredBy } from '@/components/app/powered-by'

const STEPS = ['Search the drawing by vehicle, battery and tray size', 'Download it, or get the closest standard alternatives', 'No match? Raise a request in one standard form', 'Engineering uploads it — you are notified instantly']
const draw = (delay: number) => ({ initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 1.4, delay, ease: 'easeOut' as const } })
const fade = (delay: number) => ({ initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.5, delay } })

function Hero() {
  const [i, setI] = useState(0)
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % STEPS.length), 2200); return () => clearInterval(t) }, [])
  return (
    <section className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-br from-[#1b1e23] to-[#121417] px-6 py-8 text-white lg:px-12 lg:py-10" aria-label="About the portal">
      <div className="pointer-events-none absolute -top-40 -right-40 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(224,106,44,.35),transparent_70%)]" />
      <div className="pointer-events-none absolute -bottom-36 -left-24 size-[380px] rounded-full bg-[radial-gradient(circle,rgba(95,168,80,.25),transparent_70%)]" />
      <div className="relative z-10 flex items-center gap-4"><img src="/brand/amaron-brute.png" alt="Amaron Brute" className="h-12 w-auto" /><div className="h-8 w-px bg-white/20" /><div className="font-heading text-[17px] font-bold">Drawing Portal</div></div>
      <div className="min-h-4 flex-1" />
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative z-10 ">
        <h1 className="mb-3 font-heading text-[28px] leading-snug font-bold tracking-tight">Every battery tray drawing. One place. Always the right revision.</h1>
        <p className="text-sm leading-relaxed text-white/65">A single intranet portal for Marketing and Application Engineering: search and download drawings, get closest-fit suggestions, and raise modification or new-drawing requests with full traceability.</p>
      </motion.div>
      <div aria-hidden="true" className="relative z-10 my-4 aspect-[360/175] overflow-hidden rounded-2xl border border-white/10 bg-[#14171b] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:20px_20px]">
        <svg className="absolute inset-0 size-full" viewBox="0 0 360 175" preserveAspectRatio="xMidYMid meet">
          <g fill="none" strokeLinejoin="round">
            <motion.rect x="52" y="48" width="170" height="82" rx="3" stroke="#E06A2C" strokeWidth="1.6" {...draw(0)} />
            <motion.path d="M52 70h170M52 108h170M110 48v82M165 48v82" stroke="#7B8794" strokeWidth="1" {...draw(0.35)} />
            <motion.path d="M222 48l36-18v82l-36 18M52 48l36-18h170" stroke="#5FA850" strokeWidth="1.6" {...draw(0.7)} />
          </g>
          {[[52, 48], [222, 48], [222, 130], [52, 130]].map(([x, y], n) => <motion.circle key={n} cx={x} cy={y} r="3" fill="#E06A2C" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.4 + n * 0.15, type: 'spring', stiffness: 300 }} />)}
          <motion.g stroke="#9AA4AF" fill="#C9D1D9" fontSize="10" fontFamily="IBM Plex Mono,monospace" {...fade(2.05)}><path d="M52 146h170M52 142v8M222 142v8" /><text x="118" y="159" stroke="none">600 mm</text></motion.g>
          <motion.g stroke="#9AA4AF" fill="#C9D1D9" fontSize="10" fontFamily="IBM Plex Mono,monospace" {...fade(2.25)}><path d="M36 48v82M32 48h8M32 130h8" /><text x="6" y="92" stroke="none" transform="rotate(-90 14 92)">400 mm</text></motion.g>
          <motion.g {...fade(2.5)}><rect x="238" y="140" width="104" height="22" rx="11" fill="#5FA850" /><text x="290" y="155" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="700" fontFamily="Inter,sans-serif">FIT VERIFIED</text></motion.g>
        </svg>
        <motion.div className="pointer-events-none absolute inset-x-0 h-11 bg-gradient-to-b from-transparent via-brand/30 to-transparent" animate={{ y: [-50, 200, -50] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }} />
      </div>
      <div className="relative z-10 mb-3.5 rounded-2xl border border-white/10 bg-white/[.04] px-[18px] py-3.5">
        <div className="mb-3 text-[10.5px] font-bold tracking-wide text-white/45 uppercase">How it works</div>
        <div className="relative grid gap-2 sm:grid-cols-4">
          <div className="absolute top-[9px] right-2 left-2 hidden h-px bg-white/10 sm:block" />
          {STEPS.map((s, n) => <div key={n} className={cn('relative flex flex-col gap-2 text-[11.5px] leading-snug transition-colors duration-300', n === i ? 'text-white' : 'text-white/40')}>
            <motion.div animate={{ scale: n === i ? 1.12 : 1 }} className={cn('relative z-10 flex size-[18px] items-center justify-center rounded-full border text-[10px] font-bold', n === i ? 'border-brand bg-brand text-white' : 'border-white/15 bg-[#22262c] text-white/50')}>{n + 1}</motion.div>{s}</div>)}
        </div>
      </div>
      <div className="relative z-10 flex gap-7">{[['2,000+', 'Drawings centralised'], ['±20/10/20', 'mm closest-fit tolerance'], ['100%', 'Version traceable']].map(([n, l]) => <div key={l}><div className="font-heading text-[22px] font-bold">{n}</div><div className="text-[11.5px] text-white/55">{l}</div></div>)}</div>
    </section>
  )
}

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.') })

export default function LoginPage() {
  const user = useAuth(s => s.user); const requestOtp = useAuth(s => s.requestOtp); const verifyOtp = useAuth(s => s.verifyOtp)
  const nav = useNavigate(); const [sp] = useSearchParams()
  const next = sp.get('next'); const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/'
  const [step, setStep] = useState<'email' | 'code'>('email'); const [email, setEmail] = useState('')
  const [remember, setRemember] = useState(!!prefs.lastEmail()); const [error, setError] = useState(''); const [cooldown, setCooldown] = useState(0)
  const emailForm = useForm({ resolver: zodResolver(emailSchema), defaultValues: { email: prefs.lastEmail() } })
  const codeForm = useForm({ resolver: zodResolver(codeSchema), defaultValues: { code: '' } })
  const codeRef = useRef<HTMLInputElement>(null); const verifying = useRef(false)
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t) }, [cooldown])
  if (user) return <Navigate to={dest} replace />

  const send = async (addr: string) => {
    setError('')
    try { await requestOtp(addr); setEmail(addr); prefs.setLastEmail(remember ? addr : ''); setStep('code'); setCooldown(60); codeForm.reset({ code: '' }); setTimeout(() => codeRef.current?.focus(), 50) }
    catch (e) { setError(errMsg(e)) }
  }
  const verify = async (code: string) => {
    if (verifying.current) return                // typing the 6th digit AND pressing Enter must not verify twice (the 2nd call would fail on a used code)
    verifying.current = true; setError('')
    try { await verifyOtp(email, code); nav(dest, { replace: true }) }
    catch (e) { setError(errMsg(e)); codeForm.reset({ code: '' }); codeRef.current?.focus() }
    finally { verifying.current = false }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Hero />
      <section className="relative flex flex-1 items-center justify-center p-7 lg:p-10">
        <PoweredBy className="absolute right-6 bottom-4" />
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex items-center justify-between"><img src="/brand/amaron-brute.png" alt="Amaron Brute" className="h-10 w-auto" /><img src="/brand/amara-raja.png" alt="Amara Raja" className="h-11 w-auto" /></div>
          <AnimatePresence mode="wait" initial={false}>
            {step === 'email' ? (
              <motion.div key="email" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <h2 className="mb-1.5 font-heading text-[23px] font-bold tracking-tight">Sign in</h2>
                <p className="mb-6 text-[13.5px] text-muted-foreground">Use your company e-mail. We'll send a one-time code — no password to remember.</p>
                <FormError>{error}</FormError>
                <Form {...emailForm}>
                  <form onSubmit={emailForm.handleSubmit(v => send(v.email))} noValidate className="grid gap-4">
                    <FInput control={emailForm.control} name="email" label="Work e-mail" required type="email" autoComplete="email" autoFocus placeholder="name@company.com" />
                    <div className="flex items-center gap-2"><Checkbox id="remember" checked={remember} onCheckedChange={v => setRemember(v === true)} /><Label htmlFor="remember" className="text-xs font-medium text-muted-foreground">Remember my e-mail on this device</Label></div>
                    <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-sm font-extrabold" disabled={emailForm.formState.isSubmitting}>{emailForm.formState.isSubmitting ? <Spinner /> : <>Send sign-in code <ArrowRight /></>}</Button>
                  </form>
                </Form>
                <p className="mt-5 text-center text-xs text-muted-foreground">Access is granted by Application Engineering. Need access? Contact your admin.</p>
              </motion.div>
            ) : (
              <motion.div key="code" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                <h2 className="mb-1.5 font-heading text-[23px] font-bold tracking-tight">Enter your code</h2>
                <p className="mb-6 text-[13.5px] text-muted-foreground">If {email} is registered, a 6-digit code is on its way. It expires in 5 minutes.</p>
                <FormError>{error}</FormError>
                {error && <p className="-mt-2 mb-4 text-xs text-muted-foreground">Tip: use the newest e-mail we sent (the latest 3 codes work), type it within 5 minutes, and check Spam/Junk. Still stuck? Tap “Resend code”.</p>}
                <form onSubmit={codeForm.handleSubmit(v => verify(v.code))} noValidate className="grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="otp" className="text-xs font-bold">6-digit code</Label>
                    <Input id="otp" autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="······" className="h-12 text-center font-mono text-[22px] font-semibold tracking-[.5em]"
                      {...codeForm.register('code', { onChange: e => { const v = String(e.target.value).replace(/\D/g, '').slice(0, 6); e.target.value = v; if (v.length === 6) void verify(v) } })}
                      ref={el => { codeForm.register('code').ref(el); codeRef.current = el }} />
                    {codeForm.formState.errors.code && <p role="alert" className="text-xs font-semibold text-destructive">{codeForm.formState.errors.code.message}</p>}
                  </div>
                  <Button type="submit" size="lg" className="h-11 w-full rounded-xl text-sm font-extrabold" disabled={codeForm.formState.isSubmitting}>{codeForm.formState.isSubmitting ? <Spinner /> : 'Verify & sign in'}</Button>
                  <div className="flex justify-between text-[13px]">
                    <button type="button" className="font-bold text-brand-dark" onClick={() => { setStep('email'); setError('') }}>Use a different e-mail</button>
                    <button type="button" disabled={cooldown > 0} className="font-bold text-brand-dark disabled:opacity-50" onClick={() => void send(email)}>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  )
}
