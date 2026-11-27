import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { prefs } from "@/lib/cookies";
import { emailSchema } from "@/lib/schemas";
import { useAuth } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FInput } from "@/components/app/fields";
import { FormError, Spinner, errMsg } from "@/components/app/common";
import { PoweredBy } from "@/components/app/powered-by";
import { LoginBackdrop, LoginHero } from "@/components/app/login-hero";

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export default function LoginPage() {
  const user = useAuth((s) => s.user);
  const requestOtp = useAuth((s) => s.requestOtp);
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const next = sp.get("next");
  const dest =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(!!prefs.lastEmail());
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const emailForm = useForm({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: prefs.lastEmail() },
  });
  const codeForm = useForm({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: "" },
  });
  const codeRef = useRef<HTMLInputElement>(null);
  const verifying = useRef(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  if (user) return <Navigate to={dest} replace />;

  const send = async (addr: string) => {
    setError("");
    try {
      await requestOtp(addr);
      setEmail(addr);
      prefs.setLastEmail(remember ? addr : "");
      setStep("code");
      setCooldown(60);
      codeForm.reset({ code: "" });
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(errMsg(e));
    }
  };
  const verify = async (code: string) => {
    if (verifying.current) return; // typing the 6th digit AND pressing Enter must not verify twice (the 2nd call would fail on a used code)
    verifying.current = true;
    setError("");
    try {
      await verifyOtp(email, code);
      nav(dest, { replace: true });
    } catch (e) {
      setError(errMsg(e));
      codeForm.reset({ code: "" });
      codeRef.current?.focus();
    } finally {
      verifying.current = false;
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#0e1013] lg:flex-row">
      <LoginBackdrop />
      <LoginHero />
      <section className="relative z-10 flex items-center justify-center p-5 pb-14 lg:w-[540px] lg:shrink-0 lg:p-10">
        <PoweredBy className="absolute right-6 bottom-4 text-white/45 [&_a]:text-white/70 [&_a:hover]:text-white" />
        <div className="w-full max-w-[420px] rounded-[28px] bg-white p-7 shadow-[0_30px_80px_rgba(0,0,0,.55)] sm:p-9">
          <div className="mb-8 flex items-center justify-between">
            <img
              src="/brand/amaron-brute.png"
              alt="Amaron Brute"
              className="h-10 w-auto"
            />
            <img
              src="/brand/amara-raja.png"
              alt="Amara Raja"
              className="h-11 w-auto"
            />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {step === "email" ? (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="mb-1.5 font-heading text-[23px] font-bold tracking-tight">
                  Sign in
                </h2>
                <p className="mb-6 text-[13.5px] text-muted-foreground">
                  Use your company e-mail. We'll send a one-time code — no
                  password to remember.
                </p>
                <FormError>{error}</FormError>
                <Form {...emailForm}>
                  <form
                    onSubmit={emailForm.handleSubmit((v) => send(v.email))}
                    noValidate
                    className="grid gap-4"
                  >
                    <FInput
                      control={emailForm.control}
                      name="email"
                      label="Work e-mail"
                      required
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="name@company.com"
                    />
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={remember}
                        onCheckedChange={(v) => setRemember(v === true)}
                      />
                      <Label
                        htmlFor="remember"
                        className="text-xs font-medium text-muted-foreground"
                      >
                        Remember my e-mail on this device
                      </Label>
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="h-11 w-full rounded-xl text-sm font-extrabold"
                      disabled={emailForm.formState.isSubmitting}
                    >
                      {emailForm.formState.isSubmitting ? (
                        <Spinner />
                      ) : (
                        <>
                          Send sign-in code <ArrowRight />
                        </>
                      )}
                    </Button>
                  </form>
                </Form>
                <p className="mt-5 text-center text-xs text-muted-foreground">
                  Access is granted by Application Engineering. Need access?
                  Contact your admin.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.18 }}
              >
                <h2 className="mb-1.5 font-heading text-[23px] font-bold tracking-tight">
                  Enter your code
                </h2>
                <p className="mb-6 text-[13.5px] text-muted-foreground">
                  If {email} is registered, a 6-digit code is on its way. It
                  expires in 5 minutes.
                </p>
                <FormError>{error}</FormError>
                {error && (
                  <p className="-mt-2 mb-4 text-xs text-muted-foreground">
                    Tip: use the newest e-mail we sent (the latest 3 codes
                    work), type it within 5 minutes, and check Spam/Junk. Still
                    stuck? Tap “Resend code”.
                  </p>
                )}
                <form
                  onSubmit={codeForm.handleSubmit((v) => verify(v.code))}
                  noValidate
                  className="grid gap-4"
                >
                  <div className="grid gap-1.5">
                    <Label htmlFor="otp" className="text-xs font-bold">
                      6-digit code
                    </Label>
                    <Input
                      id="otp"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="······"
                      className="h-12 text-center font-mono text-[22px] font-semibold tracking-[.5em]"
                      {...codeForm.register("code", {
                        onChange: (e) => {
                          const v = String(e.target.value)
                            .replace(/\D/g, "")
                            .slice(0, 6);
                          e.target.value = v;
                          if (v.length === 6) void verify(v);
                        },
                      })}
                      ref={(el) => {
                        codeForm.register("code").ref(el);
                        codeRef.current = el;
                      }}
                    />
                    {codeForm.formState.errors.code && (
                      <p
                        role="alert"
                        className="text-xs font-semibold text-destructive"
                      >
                        {codeForm.formState.errors.code.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 w-full rounded-xl text-sm font-extrabold"
                    disabled={codeForm.formState.isSubmitting}
                  >
                    {codeForm.formState.isSubmitting ? (
                      <Spinner />
                    ) : (
                      "Verify & sign in"
                    )}
                  </Button>
                  <div className="flex justify-between text-[13px]">
                    <button
                      type="button"
                      className="font-bold text-brand-dark"
                      onClick={() => {
                        setStep("email");
                        setError("");
                      }}
                    >
                      Use a different e-mail
                    </button>
                    <button
                      type="button"
                      disabled={cooldown > 0}
                      className="font-bold text-brand-dark disabled:opacity-50"
                      onClick={() => void send(email)}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}