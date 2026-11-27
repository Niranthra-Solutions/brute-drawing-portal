import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  FilePlus2,
  Search,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SLIDES_DATA } from "./showcase-images";

const ORANGE = "#e06a2c";
const INTERVAL = 5200;

const CHIPS = [
  "Voltage",
  "Ah rating",
  "Tray size",
  "Connector",
  "AFS",
  "Drain holes",
];

const STEPS = [
  ["Marketing", "Searches the drawing"],
  ["Portal", "Suggests the closest fit"],
  ["Marketing", "Raises a request"],
  ["Engineering", "Uploads and notifies"],
];

const FEATURES: { icon: LucideIcon; t: string; d: string }[] = [
  { icon: Search, t: "Search", d: "by vehicle, battery and tray size" },
  { icon: Target, t: "Closest fit", d: "standard alternatives suggested" },
  { icon: FilePlus2, t: "Request", d: "modification or new drawing" },
  { icon: ShieldCheck, t: "Traceable", d: "every revision on record" },
];

const LINE = "rgba(214,220,227,.5)";
const DIM = "rgba(154,164,175,.55)";

function Blueprint() {
  const draw = (delay: number, dur = 1.6) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: dur, delay, ease: "easeInOut" as const },
  });
  const cells = Array.from({ length: 12 }, (_, n) => ({
    x: 70 + (n % 6) * 92,
    y: 70 + Math.floor(n / 6) * 112,
  }));
  return (
    <svg
      className="absolute top-[9%] right-0 h-[90%] w-[62%] min-w-[640px] opacity-90 [mask-image:linear-gradient(to_left,black_55%,transparent)]"
      viewBox="0 0 700 560"
      preserveAspectRatio="xMaxYMin meet"
      fill="none"
      strokeWidth="1.2"
    >
      <motion.rect
        x="40"
        y="40"
        width="620"
        height="260"
        rx="22"
        stroke={LINE}
        {...draw(0.2)}
      />
      <motion.rect
        x="54"
        y="54"
        width="592"
        height="232"
        rx="14"
        stroke={LINE}
        {...draw(0.5)}
      />
      <motion.path
        d="M64 66 q10 -14 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0"
        stroke={ORANGE}
        strokeOpacity=".8"
        {...draw(0.8, 2.2)}
      />
      {cells.map((c, n) => (
        <motion.g key={n} {...draw(1 + n * 0.08, 0.9)}>
          <rect x={c.x} y={c.y} width="80" height="96" stroke={LINE} />
          <circle cx={c.x + 14} cy={c.y + 14} r="6" stroke={LINE} />
          <circle cx={c.x + 66} cy={c.y + 14} r="6" stroke={LINE} />
          <path
            d={`M${c.x + 10} ${c.y + 44}h60M${c.x + 10} ${c.y + 58}h60M${c.x + 10} ${c.y + 72}h60`}
            stroke={DIM}
          />
        </motion.g>
      ))}
      <motion.path
        d="M40 330h620M40 322v16M660 322v16"
        stroke={DIM}
        {...draw(1.6)}
      />
      <text
        x="350"
        y="350"
        fill={DIM}
        fontSize="12"
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        stroke="none"
      >
        830
      </text>
      <motion.path
        d="M690 40v260M682 40h16M682 300h16"
        stroke={DIM}
        {...draw(1.8)}
      />
      <motion.path
        d="M20 170h20M350 20v20"
        stroke={ORANGE}
        strokeOpacity=".7"
        {...draw(1.4)}
      />
      <motion.rect
        x="360"
        y="380"
        width="300"
        height="130"
        stroke={LINE}
        {...draw(1.2)}
      />
      <motion.path
        d="M376 410h268M376 440h268M376 470h268"
        stroke={DIM}
        {...draw(1.7)}
      />
      <circle cx="396" cy="396" r="5" stroke={LINE} />
      <circle cx="624" cy="396" r="5" stroke={LINE} />
      <g stroke="none" fontFamily="IBM Plex Mono, monospace">
        <rect
          x="150"
          y="2"
          width="56"
          height="20"
          rx="3"
          fill={ORANGE}
          fillOpacity=".3"
        />
        <text x="178" y="16" fill={ORANGE} fontSize="11" textAnchor="middle">
          REV B
        </text>
      </g>
    </svg>
  );
}

export function LoginBackdrop() {
  return (
    <div
      className="login-anim pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes login-flow { to { stroke-dashoffset: -60 } }
        @keyframes login-pulse { 0%,100% { opacity: .55; transform: scale(1) } 50% { opacity: 1; transform: scale(1.08) } }
        @media (prefers-reduced-motion: reduce) {
          .login-anim, .login-anim * { animation: none !important; }
        }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_35%_-10%,rgba(255,255,255,.08),transparent_50%),radial-gradient(circle_at_8%_8%,rgba(224,106,44,.30),transparent_42%),radial-gradient(circle_at_0%_100%,rgba(95,168,80,.18),transparent_40%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] [background-size:28px_28px]" />
      <Blueprint />
      <div className="absolute top-3 right-[3%] hidden rounded border border-white/15 bg-black/20 px-4 py-3 font-mono text-[12px] leading-6 tracking-[.18em] text-white/50 uppercase lg:block">
        <div>
          Drawing no. <span className="ml-3 text-white/80">25 600 002 B</span>
        </div>
        <div>
          Battery <span className="ml-3 text-white/80">48V · 775 Ah</span>
        </div>
        <div>
          Rev · scale <span className="ml-3 text-[#5fa850]">B · 1:10</span>
        </div>
      </div>
    </div>
  );
}

const shortName = (n: string) => n.replace(/ Battery Bank$/, "");

export function LoginHero() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);

  useEffect(() => {
    if (hold) return;
    const t = setTimeout(
      () => setI((x) => (x + 1) % SLIDES_DATA.length),
      INTERVAL,
    );
    return () => clearTimeout(t);
  }, [i, hold]);

  const s = SLIDES_DATA[i];
  const num = String(i + 1).padStart(2, "0");

  return (
    <section
      className="relative z-10 flex flex-1 flex-col justify-center px-6 py-8 text-white lg:py-8 lg:pr-4 lg:pl-14"
      aria-label="About the portal"
    >
      <div className="mx-auto w-full max-w-[1040px] lg:mx-0 lg:max-w-none">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <img
            src="/brand/amaron-brute.png"
            alt="Amaron Brute"
            className="h-11 w-auto"
          />
          <div className="h-8 w-px bg-white/20" />
          <div>
            <div className="font-heading text-[17px] leading-tight font-bold">
              Drawing Portal
            </div>
            <div className="font-mono text-[10.5px] tracking-[.26em] text-white/45 uppercase">
              Amara Raja · Industrial batteries
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-6"
        >
          <h1 className="font-heading text-[30px] leading-[1.08] font-bold tracking-tight sm:text-[40px] xl:text-[46px]">
            Find the right drawing for
            <br />
            <span className="bg-gradient-to-r from-[#e06a2c] to-[#ff9a62] bg-clip-text text-transparent">
              every battery bank.
            </span>
          </h1>
          <p className="mt-3 max-w-[560px] text-[14px] leading-relaxed text-white/55">
            Search, download and request tray drawings for every vehicle we
            power. Always the latest revision, always on record.
          </p>
        </motion.div>

        <div
          className="mt-6 flex flex-col gap-5 lg:flex-row"
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
        >
          <div className="hidden w-[210px] shrink-0 flex-col lg:flex">
            {SLIDES_DATA.map((d, n) => {
              const active = n === i;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  className={cn(
                    "relative flex flex-1 items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left transition-all duration-300",
                    active
                      ? "bg-gradient-to-r from-[#e06a2c] to-[#c9571d] shadow-[0_10px_30px_rgba(224,106,44,.35)]"
                      : "hover:bg-white/[.05]",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[12px]",
                      active ? "text-white" : "text-[#5fa850]",
                    )}
                  >
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[14px] font-semibold">
                      {shortName(d.name)}
                    </span>
                    <span
                      className={cn(
                        "block text-[11.5px]",
                        active ? "text-white/80" : "text-white/45",
                      )}
                    >
                      Battery bank
                    </span>
                  </span>
                  {active && !hold && (
                    <motion.span
                      key={`bar-${i}`}
                      className="absolute bottom-0 left-0 h-[3px] bg-white/70"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: INTERVAL / 1000, ease: "linear" }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex gap-1.5 overflow-x-auto lg:hidden">
            {SLIDES_DATA.map((d, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setI(n)}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold",
                  n === i
                    ? "border-[#e06a2c] bg-[#e06a2c] text-white"
                    : "border-white/15 text-white/60",
                )}
              >
                {shortName(d.name)}
              </button>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative h-[330px] min-w-0 lg:flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_70%_90%,rgba(224,106,44,.2),transparent_55%),linear-gradient(160deg,rgba(23,27,33,.92),rgba(10,12,15,.96))] shadow-[0_30px_80px_rgba(0,0,0,.5)] sm:h-[400px] min-[1700px]:h-[500px]"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={i}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="pointer-events-none absolute -top-6 right-[8%] font-heading text-[220px] leading-none font-bold text-white/[.04] select-none">
                  {num}
                </div>
                <div className="absolute top-4 right-4 z-10 hidden max-w-[52%] flex-wrap justify-end gap-1.5 sm:flex">
                  {CHIPS.map((c) => (
                    <span
                      key={c}
                      className="rounded-md border border-white/12 bg-white/[.06] px-2 py-1 font-mono text-[10.5px] tracking-wider text-white/65 uppercase"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <span className="absolute top-4 left-4 z-10 rounded-lg bg-[#e06a2c] px-3 py-1.5 font-mono text-[11px] font-semibold tracking-widest text-white uppercase">
                  {s.tag}
                </span>
                <div className="absolute inset-x-0 top-[9%] bottom-[19%] flex items-end justify-center gap-[3%] px-[3%]">
                  <motion.img
                    src={s.battery}
                    alt={s.name}
                    className="h-full max-w-[52%] min-w-0 object-contain object-bottom drop-shadow-[0_24px_28px_rgba(0,0,0,.65)]"
                    initial={{ y: -80, opacity: 0, scale: 0.94 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 70, damping: 14 }}
                  />
                  <motion.img
                    src={s.truck}
                    alt={s.tag}
                    className="h-[88%] max-w-[44%] min-w-0 object-contain object-bottom drop-shadow-[0_16px_20px_rgba(0,0,0,.6)]"
                    initial={{ x: 120, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 60,
                      damping: 14,
                      delay: 0.2,
                    }}
                  />
                </div>
                <div className="absolute right-6 bottom-4 left-6 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-heading text-[20px] leading-tight font-bold sm:text-[26px]">
                      {s.name}
                    </div>
                    <div className="mt-1 font-mono text-[10.5px] tracking-[.2em] text-white/45 uppercase">
                      Drawings by voltage · Ah · tray size
                    </div>
                  </div>
                  <span className="font-mono text-[12px] text-white/40">
                    {num} / {String(SLIDES_DATA.length).padStart(2, "0")}
                  </span>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 xl:grid-cols-4"
        >
          {FEATURES.map((f) => (
            <div key={f.t} className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[.04] text-[#e06a2c]">
                <f.icon className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold">{f.t}</div>
                <div className="text-[12.5px] leading-snug text-white/50">
                  {f.d}
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-5 flex flex-wrap items-center gap-2"
        >
          {STEPS.map(([who, what], n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px]",
                  n === 0
                    ? "border-[#e06a2c]/60 bg-[#e06a2c]/10"
                    : "border-white/12 bg-white/[.04]",
                )}
              >
                <span className="font-mono text-[#5fa850]">
                  {String(n + 1).padStart(2, "0")}
                </span>
                <span className="font-semibold">{who}</span>
                <span className="text-white/55">· {what}</span>
              </div>
              {n < STEPS.length - 1 && (
                <ArrowRight className="hidden size-3.5 text-white/30 min-[1700px]:block" />
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}