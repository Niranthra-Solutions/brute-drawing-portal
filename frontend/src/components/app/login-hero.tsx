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

type Layout = {
  cols: number;
  rows: number;
  w: number;
  h: number;
  route: "rows" | "snake" | "stair" | "bus";
  divider: "v" | "h" | "none";
  blocks: 1 | 2;
  takeoff: "top" | "bottom" | "side";
  dim: string;
};

const LAYOUTS: Layout[] = [
  {
    cols: 6,
    rows: 4,
    w: 330,
    h: 440,
    route: "rows",
    divider: "v",
    blocks: 1,
    takeoff: "top",
    dim: "W=198",
  },
  {
    cols: 8,
    rows: 3,
    w: 520,
    h: 300,
    route: "snake",
    divider: "none",
    blocks: 1,
    takeoff: "side",
    dim: "W=155",
  },
  {
    cols: 4,
    rows: 6,
    w: 250,
    h: 460,
    route: "bus",
    divider: "h",
    blocks: 1,
    takeoff: "bottom",
    dim: "W=210",
  },
  {
    cols: 3,
    rows: 4,
    w: 480,
    h: 380,
    route: "rows",
    divider: "none",
    blocks: 2,
    takeoff: "top",
    dim: "W=180",
  },
  {
    cols: 5,
    rows: 5,
    w: 380,
    h: 400,
    route: "stair",
    divider: "h",
    blocks: 1,
    takeoff: "side",
    dim: "W=165",
  },
  {
    cols: 4,
    rows: 3,
    w: 360,
    h: 280,
    route: "bus",
    divider: "v",
    blocks: 1,
    takeoff: "bottom",
    dim: "W=240",
  },
  {
    cols: 7,
    rows: 2,
    w: 540,
    h: 220,
    route: "snake",
    divider: "v",
    blocks: 1,
    takeoff: "top",
    dim: "W=140",
  },
];

function ConnectionLayout({ l, title }: { l: Layout; title: string }) {
  const ink = "rgba(225,230,236,.9)";
  const pad = 22;
  const top = 40;
  const vbW = l.w + pad * 2;
  const vbH = l.h + top + 50;
  const gap = l.blocks === 2 ? 26 : 0;
  const innerW = l.w - 36 - gap;
  const blockW = innerW / l.blocks;
  const innerH = l.h - 36;
  const ox = pad + 18;
  const oy = top + 18;
  const cw = blockW / l.cols;
  const ch = innerH / l.rows;
  const mono = "IBM Plex Mono, monospace";
  const line = (delay: number, dur = 0.8) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration: dur, delay, ease: "easeInOut" as const },
  });
  const cells: {
    x: number;
    y: number;
    n: number;
    c: number;
    r: number;
    b: number;
  }[] = [];
  for (let b = 0; b < l.blocks; b++)
    for (let r = 0; r < l.rows; r++)
      for (let c = 0; c < l.cols; c++)
        cells.push({
          x: ox + b * (blockW + gap) + c * cw,
          y: oy + r * ch,
          n: cells.length,
          c,
          r,
          b,
        });
  const cables: string[] = [];
  for (const k of cells) {
    const last = k.c === l.cols - 1;
    if (l.route === "rows" || l.route === "snake") {
      if (!last) {
        const yy = k.y + (k.r % 2 ? ch - 14 : 14);
        cables.push(
          `M${k.x + cw - 12} ${yy}Q${k.x + cw} ${yy - 12} ${k.x + cw + 12} ${yy}`,
        );
      }
      if (l.route === "snake" && last && k.r < l.rows - 1) {
        const xx = k.r % 2 ? k.x + 14 : k.x + cw - 14;
        cables.push(
          `M${xx} ${k.y + ch - 10}Q${xx + (k.r % 2 ? -14 : 14)} ${k.y + ch} ${xx} ${k.y + ch + 10}`,
        );
      }
    }
    if (l.route === "stair" && !last && k.r < l.rows - 1) {
      cables.push(
        `M${k.x + cw - 12} ${k.y + ch - 14}L${k.x + cw + 12} ${k.y + ch + 14}`,
      );
    }
    if (l.route === "bus" && k.r < l.rows - 1) {
      const xx = k.x + (k.c % 2 ? cw - 14 : 14);
      cables.push(`M${xx} ${k.y + ch - 12}V${k.y + ch + 12}`);
    }
  }
  const busY = oy - 8;
  const mid = {
    v: `M${pad + 18 + innerW / 2 + (l.blocks === 2 ? gap / 2 : 0)} ${oy - 18}V${oy + innerH + 18}`,
    h: `M${pad} ${oy + innerH / 2}H${pad + l.w}`,
    none: "",
  }[l.divider];
  return (
    <svg
      className="pointer-events-none absolute top-[6%] right-[1%] h-[88%] w-[52%] opacity-[.34] [mask-image:linear-gradient(to_right,transparent,black_26%)]"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMaxYMid meet"
      fill="none"
      stroke={ink}
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="hatch"
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <path d="M0 0V7" stroke={ink} strokeWidth="1" />
        </pattern>
      </defs>
      <motion.rect x={pad} y="6" width={l.w} height="24" {...line(0.1)} />
      <text
        x={pad + 10}
        y="23"
        fill={ink}
        stroke="none"
        fontSize="13"
        fontFamily={mono}
      >
        CONNECTION LAYOUT · {title}
      </text>
      <motion.rect
        x={pad}
        y={top}
        width={l.w}
        height={l.h}
        {...line(0.2, 1.1)}
      />
      <motion.rect
        x={pad}
        y={top}
        width={l.w}
        height={l.h}
        fill="url(#hatch)"
        stroke="none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ delay: 0.9, duration: 0.8 }}
      />
      {Array.from({ length: l.blocks }, (_, b) => (
        <g key={b}>
          <rect
            x={ox - 4 + b * (blockW + gap)}
            y={oy - 4}
            width={blockW + 8}
            height={innerH + 8}
            fill="#0f1215"
            stroke="none"
          />
          <motion.rect
            x={ox - 4 + b * (blockW + gap)}
            y={oy - 4}
            width={blockW + 8}
            height={innerH + 8}
            strokeWidth="2.6"
            {...line(0.4, 1.2)}
          />
        </g>
      ))}
      {cells.map((k) => {
        const d = 0.6 + k.n * 0.025;
        const horiz = l.cols > l.rows * 1.6;
        return (
          <g key={k.n}>
            <motion.rect
              x={k.x + 2}
              y={k.y + 2}
              width={cw - 4}
              height={ch - 4}
              rx="7"
              {...line(d, 0.7)}
            />
            <motion.rect
              x={k.x + cw / 2 - (horiz ? 11 : 13)}
              y={k.y + ch / 2 - (horiz ? 9 : 14)}
              width={horiz ? 22 : 26}
              height={horiz ? 18 : 30}
              rx="8"
              {...line(d + 0.2, 0.6)}
            />
            <circle cx={k.x + 14} cy={k.y + 14} r="6" />
            <circle cx={k.x + 14} cy={k.y + 14} r="2" />
            <circle cx={k.x + cw - 14} cy={k.y + ch - 14} r="6" />
            <circle cx={k.x + cw - 14} cy={k.y + ch - 14} r="2" />
            <path
              d={`M${k.x + 10} ${k.y + ch - 20}h8M${k.x + 14} ${k.y + ch - 24}v8`}
            />
            <path d={`M${k.x + cw - 18} ${k.y + 14}h8`} />
          </g>
        );
      })}
      {l.blocks === 2 && (
        <motion.path
          d={`M${ox + blockW} ${busY}H${ox + blockW + gap}`}
          stroke="#e06a2c"
          strokeWidth="3.5"
          {...line(1.5)}
        />
      )}
      {cables.map((d, n) => (
        <path
          key={n}
          d={d}
          stroke="#e06a2c"
          strokeWidth="2.6"
          strokeDasharray="5 9"
          className="login-anim"
          style={{
            animation: `login-flow 1.6s linear ${(n % 12) * 0.08}s infinite`,
          }}
        />
      ))}
      {mid && (
        <motion.path
          d={mid}
          stroke="rgba(255,255,255,.95)"
          strokeWidth="4"
          {...line(1.4, 1)}
        />
      )}
      {l.takeoff === "top" && (
        <>
          <motion.path
            d={`M${ox + 14} ${oy + 14}L${pad - 6} ${top + 4}V${top + 90}`}
            {...line(1.8)}
          />
          <text
            x={pad - 12}
            y={top + 86}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
            transform={`rotate(-90 ${pad - 12} ${top + 86})`}
          >
            NEG. TAKE-OFF
          </text>
          <motion.path
            d={`M${pad + l.w - 32} ${oy + 14}L${pad + l.w + 6} ${top + 4}V${top + 90}`}
            {...line(2)}
          />
          <text
            x={pad + l.w + 16}
            y={top + 20}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
            transform={`rotate(90 ${pad + l.w + 16} ${top + 20})`}
          >
            POS. TAKE-OFF
          </text>
        </>
      )}
      {l.takeoff === "bottom" && (
        <>
          <motion.path
            d={`M${ox + 14} ${oy + innerH - 14}L${ox + 14} ${top + l.h + 22}H${ox + 110}`}
            {...line(1.8)}
          />
          <text
            x={ox + 14}
            y={top + l.h + 38}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
          >
            NEG. TAKE-OFF
          </text>
          <motion.path
            d={`M${ox + blockW - 14} ${oy + innerH - 14}L${ox + blockW - 14} ${top + l.h + 22}H${ox + blockW - 110}`}
            {...line(2)}
          />
          <text
            x={ox + blockW - 100}
            y={top + l.h + 38}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
          >
            POS. TAKE-OFF
          </text>
        </>
      )}
      {l.takeoff === "side" && (
        <>
          <motion.path
            d={`M${ox + 14} ${oy + innerH / 2}L${pad - 14} ${oy + innerH / 2}`}
            {...line(1.8)}
          />
          <motion.path
            d={`M${pad + l.w - 32} ${oy + innerH / 2}L${pad + l.w + 14} ${oy + innerH / 2}`}
            {...line(2)}
          />
          <text
            x={pad + l.w - 60}
            y={oy + innerH / 2 - 8}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
          >
            POS
          </text>
          <text
            x={pad + 4}
            y={oy + innerH / 2 - 8}
            fill={ink}
            stroke="none"
            fontSize="10"
            fontFamily={mono}
          >
            NEG
          </text>
        </>
      )}
      <motion.path
        d={`M${pad} ${top + l.h + 10}V${top + l.h + 24}M${pad} ${top + l.h + 17}H${pad + 100}M${pad + 100} ${top + l.h + 10}V${top + l.h + 24}`}
        {...line(2.2)}
      />
      <text
        x={pad + 106}
        y={top + l.h + 21}
        fill={ink}
        stroke="none"
        fontSize="10"
        fontFamily={mono}
      >
        {l.dim}
      </text>
    </svg>
  );
}

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
                <ConnectionLayout
                  key={`cl-${i}`}
                  l={LAYOUTS[i % LAYOUTS.length]}
                  title={s.tag}
                />

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