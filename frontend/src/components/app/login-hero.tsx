import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLIDES_DATA } from "./showcase-images";

const ORANGE = "#e06a2c";
const GREEN = "#5fa850";
const INTERVAL = 5200;

const FILTERS = ["Voltage", "Ah rating", "Tray size", "Connector"];

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
          className="mt-5 flex flex-wrap items-end justify-between gap-x-8 gap-y-2"
        >
          <h1 className="font-heading text-[30px] leading-[1.08] font-bold tracking-tight sm:text-[38px] xl:text-[44px]">
            Vehicle. Battery. Drawing.
            <br />
            <span className="bg-gradient-to-r from-[#e06a2c] to-[#ff9a62] bg-clip-text text-transparent">
              Found in one search.
            </span>
          </h1>
          <p className="max-w-[330px] text-[13.5px] leading-relaxed text-white/55">
            Search, download and request tray drawings for every vehicle we
            power. Always the latest revision.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          className="relative mt-5 h-[330px] overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(ellipse_at_72%_80%,rgba(224,106,44,.22),transparent_55%),linear-gradient(160deg,rgba(23,27,33,.92),rgba(10,12,15,.96))] shadow-[0_30px_80px_rgba(0,0,0,.5)] sm:h-[390px] min-[1700px]:h-[520px]"
        >
          <div className="absolute inset-x-0 bottom-[54px] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={i}
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div
                className="absolute right-[6%] bottom-[34px] h-8 w-[38%] rounded-[50%] bg-[#e06a2c]/35 blur-2xl"
                style={{ animation: "login-pulse 2.8s ease-in-out infinite" }}
              />
              <motion.img
                src={s.truck}
                alt={s.tag}
                className="absolute right-[3%] bottom-[48px] h-[64%] w-[42%] object-contain object-bottom drop-shadow-[0_20px_24px_rgba(0,0,0,.6)]"
                initial={{ x: 220, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 60, damping: 14 }}
              />
              <motion.div
                className="absolute top-[7%] left-[19%] h-[58%] w-[36%]"
                initial={{ y: -170, opacity: 0, rotate: -4 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 70,
                  damping: 11,
                  delay: 0.25,
                }}
              >
                <motion.img
                  src={s.battery}
                  alt={s.name}
                  className="h-full w-full object-contain drop-shadow-[0_24px_28px_rgba(0,0,0,.65)]"
                  animate={{ y: [0, -8, 0] }}
                  transition={{
                    duration: 4.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                />
              </motion.div>


              <div className="absolute top-[11%] left-4 hidden flex-col gap-2.5 sm:flex">
                {FILTERS.map((f, n) => (
                  <motion.div
                    key={f}
                    className="flex items-center gap-2"
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + n * 0.12 }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ background: n % 2 ? GREEN : ORANGE }}
                    />
                    <span className="rounded-md border border-white/12 bg-white/[.06] px-2 py-0.5 font-mono text-[10.5px] tracking-wider text-white/70 uppercase">
                      {f}
                    </span>
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="absolute top-4 right-5 flex items-center gap-2"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <span className="font-mono text-[11px] text-white/40">
                  {num} / {String(SLIDES_DATA.length).padStart(2, "0")}
                </span>
              </motion.div>

              <motion.div
                className="absolute right-6 bottom-3.5 left-6 flex items-end justify-between gap-3"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
              >
                <div>
                  <div className="font-heading text-[19px] leading-tight font-bold sm:text-[23px]">
                    {s.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10.5px] tracking-[.18em] text-white/45 uppercase">
                    <Zap className="size-3 text-[#e06a2c]" />
                    Powers the {s.tag}
                  </div>
                </div>
                <motion.div
                  className="flex items-center gap-2 rounded-full border border-[#5fa850]/40 bg-[#5fa850]/10 px-3 py-1 text-[11px] font-semibold text-[#9bd48e]"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.7 }}
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-[#5fa850]" />
                  Drawings online
                </motion.div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          className="relative mt-4"
        >
          <div className="absolute top-[23px] right-6 left-6 h-px bg-gradient-to-r from-white/5 via-white/20 to-white/5" />
          <div className="relative flex gap-2 overflow-x-auto pb-1">
            {SLIDES_DATA.map((d, n) => {
              const active = n === i;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  className="group relative flex min-w-[84px] flex-1 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={cn(
                      "relative flex h-[46px] w-full max-w-[96px] items-center justify-center overflow-hidden rounded-xl border bg-[#12151a] px-2 transition-all duration-300",
                      active
                        ? "border-[#e06a2c] shadow-[0_0_26px_rgba(224,106,44,.4)]"
                        : "border-white/12 group-hover:border-white/30",
                    )}
                  >
                    <img
                      src={d.truck}
                      alt=""
                      className={cn(
                        "h-9 w-full object-contain transition-all duration-300",
                        active
                          ? "scale-110"
                          : "opacity-60 group-hover:opacity-100",
                      )}
                    />
                    {active && !hold && (
                      <motion.span
                        key={`bar-${i}`}
                        className="absolute bottom-0 left-0 h-[3px] bg-[#e06a2c]"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: INTERVAL / 1000,
                          ease: "linear",
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] leading-tight font-semibold transition-colors",
                      active ? "text-white" : "text-white/50",
                    )}
                  >
                    {shortName(d.name)}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] tracking-wider text-white/45 uppercase"
        >
          <span>Search by vehicle</span>
          <ArrowRight className="size-3 text-[#e06a2c]" />
          <span>Closest fit suggested</span>
          <ArrowRight className="size-3 text-[#e06a2c]" />
          <span>Raise a request if missing</span>
          <ArrowRight className="size-3 text-[#e06a2c]" />
          <span>Engineering uploads</span>
        </motion.div>
      </div>
    </section>
  );
}