import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { SLIDES_DATA } from "./showcase-images";

const ORANGE = "#e06a2c";
const GREEN = "#5fa850";

const STEPS: [string, string][] = [
  ["Marketing", "Searches the drawing"],
  ["Portal", "Suggests the closest fit"],
  ["Marketing", "Raises a request"],
  ["Engineering", "Uploads and notifies"],
];

function cloudPath(x: number, y: number, w: number, h: number, r: number) {
  const nx = Math.round(w / (r * 2));
  const ny = Math.round(h / (r * 2));
  const sx = w / nx;
  const sy = h / ny;
  let d = `M${x},${y}`;
  for (let k = 0; k < nx; k++) d += `a${sx / 2},${r} 0 0 1 ${sx},0`;
  for (let k = 0; k < ny; k++) d += `a${r},${sy / 2} 0 0 1 0,${sy}`;
  for (let k = 0; k < nx; k++) d += `a${sx / 2},${r} 0 0 1 ${-sx},0`;
  for (let k = 0; k < ny; k++) d += `a${r},${sy / 2} 0 0 1 0,${-sy}`;
  return d + "Z";
}

const COLS = 6;
const ROWS = 3;
const CELL_W = 72;
const CELL_H = 82;
const GAP = 8;

function DrawLine({
  d,
  delay = 0,
  color = "#fff",
  width = 1.4,
  dash,
}: {
  d: string;
  delay?: number;
  color?: string;
  width?: number;
  dash?: string;
}) {
  return (
    <path
      d={d}
      pathLength={1}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeDasharray={dash}
      className="login-draw"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function TrayTopView() {
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      cells.push({ x: 24 + c * (CELL_W + GAP), y: 34 + r * (CELL_H + GAP) });
  const snake = Array.from({ length: ROWS }, (_, r) => {
    const ys = 34 + r * (CELL_H + GAP) + 14;
    const x0 = 24 + CELL_W / 2;
    const x1 = 24 + (COLS - 1) * (CELL_W + GAP) + CELL_W / 2;
    const down = r < ROWS - 1 ? `V${ys + CELL_H + GAP}` : "";
    return r % 2 === 0
      ? `M${x0},${ys}H${x1}${down}`
      : `M${x1},${ys}H${x0}${down}`;
  });
  const flow = (() => {
    let d = "";
    for (let r = 0; r < ROWS; r++) {
      const ys = 34 + r * (CELL_H + GAP) + 14;
      const x0 = 24 + CELL_W / 2;
      const x1 = 24 + (COLS - 1) * (CELL_W + GAP) + CELL_W / 2;
      if (r === 0) d += `M${x0},${ys}H${x1}V${ys + CELL_H + GAP}`;
      else if (r % 2 === 1) d += `H${x0}V${ys + CELL_H + GAP}`;
      else d += `H${x1}`;
    }
    return d;
  })();
  return (
    <g transform="translate(790,150)" stroke="#fff" fill="none" opacity=".26">
      <DrawLine
        d="M0,10a10,10 0 0 1 10,-10H510a10,10 0 0 1 10,10V320a10,10 0 0 1 -10,10H10a10,10 0 0 1 -10,-10Z"
        width={1.8}
      />
      <DrawLine
        d="M14,16a6,6 0 0 1 6,-6H500a6,6 0 0 1 6,6V314a6,6 0 0 1 -6,6H20a6,6 0 0 1 -6,-6Z"
        delay={0.4}
      />
      {cells.map((c, n) => (
        <g key={n}>
          <DrawLine
            d={`M${c.x},${c.y}h${CELL_W}v${CELL_H}h${-CELL_W}Z`}
            delay={0.8 + n * 0.07}
            width={1.1}
          />
          <circle
            cx={c.x + 18}
            cy={c.y + 14}
            r="6"
            className="login-fade"
            style={{ animationDelay: `${1.4 + n * 0.07}s` }}
          />
          <circle
            cx={c.x + 54}
            cy={c.y + 14}
            r="6"
            className="login-fade"
            style={{ animationDelay: `${1.4 + n * 0.07}s` }}
          />
          <path
            d={`M${c.x + 12},${c.y + 42}h48M${c.x + 12},${c.y + 52}h48M${c.x + 12},${c.y + 62}h48`}
            strokeWidth=".7"
            className="login-fade"
            style={{ animationDelay: `${1.8 + n * 0.07}s` }}
          />
        </g>
      ))}
      {snake.map((d, n) => (
        <DrawLine key={n} d={d} delay={2.6 + n * 0.3} width={1.2} />
      ))}
      <circle cx="-2" cy="165" r="7" />
      <circle cx="522" cy="165" r="7" />
      <DrawLine
        d="M-40,165H560M260,-40V370"
        delay={3}
        width={0.8}
        dash="0.03 0.012 0.006 0.012"
      />
      <g strokeWidth="1">
        <DrawLine d="M0,372V392M520,372V392M0,386H520" delay={3.4} />
        <DrawLine d="M562,0H582M562,330H582M576,0V330" delay={3.6} />
        <path
          d="M0,386l8,-3v6zM520,386l-8,-3v6zM576,0l-3,8h6zM576,330l-3,-8h6z"
          fill="#fff"
          stroke="none"
          className="login-fade"
          style={{ animationDelay: "4s" }}
        />
      </g>
      <g
        fill="#fff"
        stroke="none"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="13"
        className="login-fade"
        style={{ animationDelay: "4.2s" }}
      >
        <text x="260" y="381" textAnchor="middle">
          830
        </text>
        <text
          x="598"
          y="170"
          textAnchor="middle"
          transform="rotate(90 598 165)"
        >
          735
        </text>
      </g>
      <g opacity="1" stroke="none" fill="none">
        <path
          d={flow}
          stroke="#e06a2c"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeDasharray="8 46"
          className="login-flow"
          style={{ opacity: 0.95 }}
        />
      </g>
      <g className="login-fade" style={{ animationDelay: "4.6s" }}>
        <path
          d={cloudPath(14, 22, CELL_W * 2 + GAP + 20, CELL_H + 24, 7)}
          stroke="#e06a2c"
          strokeWidth="1.8"
        />
        <path d="M60,22V-18" stroke="#e06a2c" strokeWidth="1.2" />
        <rect
          x="32"
          y="-38"
          width="56"
          height="20"
          fill="#e06a2c"
          stroke="none"
          rx="2"
        />
        <text
          x="60"
          y="-24"
          textAnchor="middle"
          fill="#fff"
          stroke="none"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="12"
          fontWeight="700"
        >
          REV B
        </text>
      </g>
    </g>
  );
}

function ElevationView() {
  return (
    <g
      transform="translate(1010,700) scale(.8)"
      stroke="#fff"
      fill="none"
      opacity=".2"
    >
      <DrawLine d="M0,0H330V150H0Z" delay={1} width={1.6} />
      <DrawLine d="M0,22H330" delay={1.4} />
      <DrawLine d="M-14,0V-22H14M344,0V-22H316" delay={1.8} />
      <DrawLine
        d="M40,50H290M40,76H290M40,102H290M40,128H290"
        delay={2.2}
        width={0.8}
      />
      <circle
        cx="58"
        cy="11"
        r="4"
        className="login-fade"
        style={{ animationDelay: "2.8s" }}
      />
      <circle
        cx="272"
        cy="11"
        r="4"
        className="login-fade"
        style={{ animationDelay: "2.8s" }}
      />
      <DrawLine d="M350,0H368M350,150H368M362,0V150" delay={3} />
      <text
        x="380"
        y="80"
        fill="#fff"
        stroke="none"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="13"
        className="login-fade"
        style={{ animationDelay: "3.6s" }}
      >
        630
      </text>
    </g>
  );
}

function TitleBlock() {
  const mono = "IBM Plex Mono, monospace";
  return (
    <g
      transform="translate(1040,24)"
      fontFamily={mono}
      className="login-fade"
      style={{ animationDelay: "1.2s" }}
    >
      <rect
        width="340"
        height="112"
        fill="none"
        stroke="#fff"
        strokeOpacity=".28"
        strokeWidth="1.2"
      />
      <path d="M0,34H340M120,34V112" stroke="#fff" strokeOpacity=".2" />
      <text
        x="14"
        y="23"
        fill="#e06a2c"
        fontSize="13"
        fontWeight="700"
        letterSpacing="3"
      >
        AMARON BRUTE
      </text>
      <text
        x="14"
        y="56"
        fill="#fff"
        fillOpacity=".45"
        fontSize="10"
        letterSpacing="1.5"
      >
        DRAWING NO.
      </text>
      <text x="132" y="56" fill="#fff" fillOpacity=".7" fontSize="14">
        25 600 002 B
      </text>
      <text
        x="14"
        y="82"
        fill="#fff"
        fillOpacity=".45"
        fontSize="10"
        letterSpacing="1.5"
      >
        BATTERY
      </text>
      <text x="132" y="82" fill="#fff" fillOpacity=".7" fontSize="14">
        48V · 775 AH
      </text>
      <text
        x="14"
        y="102"
        fill="#fff"
        fillOpacity=".45"
        fontSize="10"
        letterSpacing="1.5"
      >
        REV · SCALE
      </text>
      <text x="132" y="102" fill="#5fa850" fontSize="12">
        B · 1:10
      </text>
    </g>
  );
}

export function LoginBackdrop() {
  return (
    <div
      className="login-anim pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes login-draw { to { stroke-dashoffset: 0; } }
        @keyframes login-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes login-flow { to { stroke-dashoffset: -54; } }
        .login-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: login-draw 2.6s ease-out forwards; }
        .login-fade { opacity: 0; animation: login-fade 1s ease-out forwards; }
        .login-flow { animation: login-flow 3.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .login-anim *, .login-anim { animation: none !important; }
          .login-draw { stroke-dashoffset: 0; }
          .login-fade { opacity: 1; }
        }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(224,106,44,.28),transparent_45%),radial-gradient(circle_at_60%_75%,rgba(224,106,44,.10),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(95,168,80,.18),transparent_40%)]" />
      <div className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:120px_120px,120px_120px,24px_24px,24px_24px]" />
      <svg
        className="absolute inset-0 hidden h-full w-full lg:block"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <TrayTopView />
        <ElevationView />
        <TitleBlock />
      </svg>
    </div>
  );
}

const shortName = (n: string) => n.replace(/ Battery Bank$/, "");

export function LoginHero() {
  const [i, setI] = useState(0);
  const [hold, setHold] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (hold) return;
    const t = setTimeout(() => setI((x) => (x + 1) % SLIDES_DATA.length), 3600);
    return () => clearTimeout(t);
  }, [i, hold]);

  useEffect(() => {
    const t = setInterval(() => setStep((x) => (x + 1) % STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);

  const s = SLIDES_DATA[i];

  return (
    <section
      className="relative z-10 flex flex-1 flex-col justify-center px-6 py-8 text-white lg:px-14 lg:py-10"
      aria-label="About the portal"
    >
      <div className="mx-auto w-full max-w-[860px] lg:mx-0">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <div className="flex h-14 items-center rounded-2xl border border-white/15 bg-white/[.06] px-4 shadow-[0_8px_30px_rgba(224,106,44,.18)] backdrop-blur">
            <img
              src="/brand/amaron-brute.png"
              alt="Amaron Brute"
              className="h-9 w-auto"
            />
          </div>
          <div>
            <div className="font-heading text-[19px] leading-tight font-bold tracking-tight uppercase">
              Drawing Portal
            </div>
            <div className="font-mono text-[11px] tracking-[.28em] text-white/45 uppercase">
              Battery tray drawings &amp; requests
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
          className="mt-7"
        >
          <h1 className="font-heading text-[34px] leading-[1.08] font-bold tracking-tight sm:text-[44px] xl:text-[52px]">
            Every battery bank drawing.
            <br />
            <span className="bg-gradient-to-r from-[#e06a2c] to-[#ff9a62] bg-clip-text text-transparent">
              Always the right revision.
            </span>
          </h1>
          <p className="mt-4 max-w-[680px] text-[14.5px] leading-relaxed text-white/65">
            One intranet portal for Marketing and Application Engineering to
            search and download drawings, get closest-fit suggestions, and raise
            modification or new-drawing requests with full traceability.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15 }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          className="mt-6 rounded-3xl border border-white/10 bg-white/[.045] p-4 shadow-[0_20px_60px_rgba(0,0,0,.35)] backdrop-blur-sm"
        >
          <div className="mb-2 flex items-center justify-between font-mono text-[11px] font-semibold tracking-[.22em] uppercase">
            <span style={{ color: ORANGE }}>Battery banks &amp; vehicles</span>
            <span className="text-white/40">
              {String(i + 1).padStart(2, "0")} /{" "}
              {String(SLIDES_DATA.length).padStart(2, "0")}
            </span>
          </div>

          <div className="relative h-[190px] overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_60%,rgba(224,106,44,.20),transparent_65%),linear-gradient(180deg,#14181d,#0d1013)] ring-1 ring-white/10">
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={i}
                className="absolute inset-0 flex items-center justify-between gap-4 px-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <motion.img
                  src={s.battery}
                  alt={s.name}
                  className="h-[168px] w-[56%] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,.55)]"
                  initial={{ x: -40, opacity: 0, scale: 0.94 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
                <div className="relative flex h-full w-[38%] flex-col items-end justify-center">
                  <motion.img
                    src={s.truck}
                    alt={s.tag}
                    className="max-h-[128px] w-full object-contain drop-shadow-[0_14px_18px_rgba(0,0,0,.5)]"
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{
                      duration: 0.55,
                      delay: 0.12,
                      ease: "easeOut",
                    }}
                  />
                  <motion.span
                    className="-mt-1 -skew-x-12 bg-[#e06a2c] px-4 py-1 text-[12px] font-extrabold tracking-wider text-white uppercase italic shadow-lg"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                  >
                    {s.tag}
                  </motion.span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5">
            {SLIDES_DATA.map((d, n) => {
              const active = n === i;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  className={cn(
                    "group relative flex min-w-[88px] flex-1 flex-col items-center gap-1 overflow-hidden rounded-xl border px-2 pt-2 pb-2 text-center transition-all duration-300",
                    active
                      ? "border-[#e06a2c]/70 bg-[#e06a2c]/10 shadow-[0_0_24px_rgba(224,106,44,.25)]"
                      : "border-white/10 bg-white/[.04] hover:border-white/25 hover:bg-white/[.07]",
                  )}
                >
                  <img
                    src={d.battery}
                    alt=""
                    className={cn(
                      "h-10 w-full object-contain transition-all duration-300",
                      active
                        ? "scale-110"
                        : "opacity-80 group-hover:opacity-100",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[11px] leading-tight font-semibold",
                      active ? "text-white" : "text-white/70",
                    )}
                  >
                    {shortName(d.name)}
                  </span>
                  <span className="text-[9.5px] leading-none text-white/40">
                    Battery Bank
                  </span>
                  {active && !hold && (
                    <motion.span
                      key={`bar-${i}`}
                      className="absolute bottom-0 left-0 h-[3px] bg-[#e06a2c]"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 3.6, ease: "linear" }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-3 rounded-2xl border border-white/10 bg-white/[.045] px-5 py-2.5 text-center backdrop-blur-sm"
        >
          <div
            className="font-mono text-[10.5px] font-bold tracking-[.25em] uppercase"
            style={{ color: ORANGE }}
          >
            Quality principle
          </div>
          <div className="font-heading text-[14.5px] font-semibold">
            Built to specification. Verified at every revision.
          </div>
        </motion.div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {STEPS.map(([who, what], n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-all duration-300",
                  n === step
                    ? "border-[#e06a2c]/70 bg-[#e06a2c]/15 text-white"
                    : "border-white/12 bg-[#15181d]/85 text-white/60",
                )}
              >
                <span
                  className="font-mono text-[11px] font-bold"
                  style={{ color: n === step ? ORANGE : GREEN }}
                >
                  {String(n + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="font-semibold">{who}</span> · {what}
                </span>
              </div>
              {n < STEPS.length - 1 && <span className="text-white/30">→</span>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}