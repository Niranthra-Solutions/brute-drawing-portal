import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FilePlus2, Search, ShieldCheck, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLIDES_DATA } from "./showcase-images";

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

const FEATURES = [
  { icon: Search, title: "Search", text: "by vehicle, battery and tray size" },
  {
    icon: Target,
    title: "Closest fit",
    text: "standard alternatives suggested",
  },
  { icon: FilePlus2, title: "Request", text: "modification or new drawing" },
  { icon: ShieldCheck, title: "Traceable", text: "every revision on record" },
];

const INTERVAL = 4200;

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
      className="relative z-10 flex flex-1 flex-col justify-center px-6 py-8 text-white lg:py-10 lg:pr-4 lg:pl-14"
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
          <h1 className="font-heading text-[32px] leading-[1.1] font-bold tracking-tight sm:text-[40px] xl:text-[46px]">
            Find the right drawing for
            <br />
            <span className="bg-gradient-to-r from-[#e06a2c] to-[#ff9a62] bg-clip-text text-transparent">
              every battery bank.
            </span>
          </h1>
          <p className="mt-3 max-w-[620px] text-[14px] leading-relaxed text-white/60">
            Search, download and request tray drawings for every vehicle we
            power. Always the latest revision, always on record.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          onMouseEnter={() => setHold(true)}
          onMouseLeave={() => setHold(false)}
          className="mt-6 grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]"
        >
          <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0">
            {SLIDES_DATA.map((d, n) => {
              const active = n === i;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setI(n)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left transition-all duration-300 lg:shrink",
                    active
                      ? "bg-gradient-to-r from-[#e06a2c] to-[#c85a1f] text-white shadow-[0_10px_30px_rgba(224,106,44,.35)]"
                      : "text-white/55 hover:bg-white/[.06] hover:text-white",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-[11px] font-bold",
                      active ? "text-white/80" : "text-[#5fa850]",
                    )}
                  >
                    {String(n + 1).padStart(2, "0")}
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[13px] font-bold whitespace-nowrap">
                      {shortName(d.name)}
                    </span>
                    <span
                      className={cn(
                        "block text-[10.5px] whitespace-nowrap",
                        active ? "text-white/75" : "text-white/35",
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

          <div className="relative h-[300px] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_30%_55%,rgba(224,106,44,.22),transparent_60%),linear-gradient(160deg,#171b21,#0c0f12)] shadow-[0_24px_70px_rgba(0,0,0,.45)] sm:h-[380px] xl:h-[410px] min-[1700px]:h-[560px]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={i}
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="absolute -top-6 right-4 font-heading text-[190px] leading-none font-extrabold text-white/[.045] select-none sm:text-[240px]"
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.7 }}
                >
                  {num}
                </motion.div>
                <div className="absolute bottom-[34px] left-[6%] h-6 w-[58%] rounded-[50%] bg-black/60 blur-xl" />
                <div className="absolute right-[3%] bottom-[28px] h-5 w-[40%] rounded-[50%] bg-black/55 blur-lg" />
                <motion.div
                  className="absolute top-[3%] bottom-[15%] left-[3%] w-[64%]"
                  initial={{ x: -60, opacity: 0, scale: 0.92 }}
                  animate={{ x: 0, opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                >
                  <motion.img
                    src={s.battery}
                    alt={s.name}
                    className="h-full w-full object-contain drop-shadow-[0_22px_26px_rgba(0,0,0,.6)]"
                    animate={{ y: [0, -7, 0] }}
                    transition={{
                      duration: 4.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </motion.div>
                <motion.img
                  src={s.truck}
                  alt={s.tag}
                  className="absolute right-[1%] bottom-[40px] h-[56%] w-[44%] object-contain drop-shadow-[0_16px_20px_rgba(0,0,0,.55)]"
                  initial={{ x: 140, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 70,
                    damping: 14,
                    delay: 0.25,
                  }}
                />
                <motion.div
                  className="absolute top-4 left-4 flex items-center gap-2"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <span className="rounded-md bg-[#e06a2c] px-2.5 py-1 font-mono text-[10.5px] font-bold tracking-widest text-white uppercase">
                    {s.tag}
                  </span>
                </motion.div>
                <motion.div
                  className="absolute right-5 bottom-4 left-5 flex items-end justify-between gap-3"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <div>
                    <div className="font-heading text-[19px] leading-tight font-bold sm:text-[22px]">
                      {s.name}
                    </div>
                    <div className="font-mono text-[10.5px] tracking-[.18em] text-white/45 uppercase">
                      Drawings by voltage · Ah · tray size
                    </div>
                  </div>
                  <div className="font-mono text-[11px] text-white/40">
                    {num} / {String(SLIDES_DATA.length).padStart(2, "0")}
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/10 pt-4 sm:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[.06] text-[#e06a2c] ring-1 ring-white/10">
                <Icon className="size-4" />
              </span>
              <div className="leading-tight">
                <div className="text-[13px] font-bold">{title}</div>
                <div className="mt-0.5 text-[11px] text-white/45">{text}</div>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}