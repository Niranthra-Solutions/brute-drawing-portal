import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Login-screen animation: four battery-tray technical drawings that are drawn line by line
 * (outline -> details -> dimensions -> title block), hold for a moment, fade out, and the next one comes in.
 * Honours "reduce motion": the first drawing is then shown fully drawn and nothing moves.
 */

const INK = "#D6DCE3"; // drawing lines
const DIM = "#9AA4AF"; // dimension lines
const ORANGE = "#E06A2C";
const GREEN = "#5FA850";
const MONO = "IBM Plex Mono,monospace";
const SCENE_MS = 7200;

type P = { rm: boolean };
const dr = (rm: boolean, delay: number, dur = 1.1) =>
  rm
    ? { initial: false as const }
    : {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: 1, opacity: 1 },
        transition: { duration: dur, delay, ease: "easeOut" as const },
      };
const fd = (rm: boolean, delay: number) =>
  rm
    ? { initial: false as const }
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.45, delay },
      };

/** Horizontal dimension line with end ticks and a centred value. */
function HDim({
  rm,
  x1,
  x2,
  y,
  label,
  delay,
}: P & { x1: number; x2: number; y: number; label: string; delay: number }) {
  return (
    <motion.g stroke={DIM} strokeWidth="0.7" fill={INK} {...fd(rm, delay)}>
      <path
        d={`M${x1} ${y}H${x2}M${x1} ${y - 3}v6M${x2} ${y - 3}v6`}
        fill="none"
      />
      <text
        x={(x1 + x2) / 2}
        y={y + 9}
        textAnchor="middle"
        fontSize="7.5"
        fontFamily={MONO}
        stroke="none"
      >
        {label}
      </text>
    </motion.g>
  );
}
/** Vertical dimension line with end ticks and a rotated value. */
function VDim({
  rm,
  x,
  y1,
  y2,
  label,
  delay,
}: P & { x: number; y1: number; y2: number; label: string; delay: number }) {
  return (
    <motion.g stroke={DIM} strokeWidth="0.7" fill={INK} {...fd(rm, delay)}>
      <path
        d={`M${x} ${y1}V${y2}M${x - 3} ${y1}h6M${x - 3} ${y2}h6`}
        fill="none"
      />
      <text
        x={x - 3}
        y={(y1 + y2) / 2}
        textAnchor="middle"
        fontSize="7.5"
        fontFamily={MONO}
        stroke="none"
        transform={`rotate(-90 ${x - 3} ${(y1 + y2) / 2})`}
      >
        {label}
      </text>
    </motion.g>
  );
}
const Label = ({
  rm,
  x,
  y,
  children,
  delay,
  anchor = "start",
  size = 7,
  fill = INK,
}: P & {
  x: number;
  y: number;
  children: React.ReactNode;
  delay: number;
  anchor?: "start" | "middle" | "end";
  size?: number;
  fill?: string;
}) => (
  <motion.text
    x={x}
    y={y}
    textAnchor={anchor}
    fontSize={size}
    fontFamily={MONO}
    fill={fill}
    {...fd(rm, delay)}
  >
    {children}
  </motion.text>
);
/** Hole with centre-lines. */
function Hole({
  rm,
  cx,
  cy,
  r,
  delay,
  colour = ORANGE,
}: P & { cx: number; cy: number; r: number; delay: number; colour?: string }) {
  return (
    <g fill="none" stroke={colour} strokeWidth="0.9">
      <motion.circle cx={cx} cy={cy} r={r} {...dr(rm, delay, 0.5)} />
      <motion.path
        d={`M${cx - r - 3} ${cy}h${2 * r + 6}M${cx} ${cy - r - 3}v${2 * r + 6}`}
        strokeWidth="0.5"
        {...dr(rm, delay + 0.2, 0.4)}
      />
    </g>
  );
}
/** Title block (bottom-right) shared by every drawing. */
function TitleBlock({
  rm,
  no,
  title,
  delay,
}: P & { no: string; title: string; delay: number }) {
  return (
    <motion.g {...fd(rm, delay)}>
      <rect
        x="226"
        y="176"
        width="126"
        height="18"
        fill="none"
        stroke={DIM}
        strokeWidth="0.7"
      />
      <path d="M262 176v18" stroke={DIM} strokeWidth="0.7" />
      <text x="230" y="188" fontSize="6" fontFamily={MONO} fill={DIM}>
        AMARON
      </text>
      <text x="266" y="183.5" fontSize="5.5" fontFamily={MONO} fill={INK}>
        {title}
      </text>
      <text
        x="266"
        y="191"
        fontSize="6"
        fontFamily={MONO}
        fill={ORANGE}
        fontWeight="700"
      >
        {no}
      </text>
    </motion.g>
  );
}

// ------------------------------------------------------------------------------------------- 1 · front + side
function ScenePlan({ rm }: P) {
  return (
    <g fill="none" strokeLinejoin="round">
      {/* FRONT VIEW */}
      <motion.rect
        x="18"
        y="38"
        width="150"
        height="78"
        stroke={INK}
        strokeWidth="1.2"
        {...dr(rm, 0)}
      />
      <motion.path
        d="M18 47H168M93 62V116M18 54h22q4 0 4-4"
        stroke={INK}
        strokeWidth="0.8"
        {...dr(rm, 0.5)}
      />
      <Hole rm={rm} cx={93} cy={50} r={3.2} delay={1.4} />
      <HDim rm={rm} x1={18} x2={168} y={130} label="1030 +0/-2" delay={2.1} />
      <VDim rm={rm} x={9} y1={38} y2={116} label="533" delay={2.3} />
      <VDim rm={rm} x={177} y1={47} y2={116} label="503" delay={2.5} />
      <Label rm={rm} x={93} y={150} anchor="middle" delay={2.7} size={7.5}>
        FRONT VIEW
      </Label>
      {/* SIDE VIEW */}
      <motion.rect
        x="205"
        y="38"
        width="140"
        height="78"
        stroke={INK}
        strokeWidth="1.2"
        {...dr(rm, 0.3)}
      />
      <motion.path
        d="M205 56H345"
        stroke={INK}
        strokeWidth="0.8"
        {...dr(rm, 0.8)}
      />
      <Hole rm={rm} cx={252} cy={47} r={3.2} delay={1.6} />
      <Hole rm={rm} cx={270} cy={47} r={3.2} delay={1.75} colour={DIM} />
      <HDim rm={rm} x1={205} x2={345} y={130} label="990 +0/-2" delay={2.2} />
      <Label rm={rm} x={275} y={150} anchor="middle" delay={2.8} size={7.5}>
        SIDE VIEW
      </Label>
      <Label
        rm={rm}
        x={252}
        y={34}
        anchor="middle"
        delay={2.4}
        size={6}
        fill={ORANGE}
      >
        Ø32
      </Label>
      <Label
        rm={rm}
        x={93}
        y={34}
        anchor="middle"
        delay={2.4}
        size={6}
        fill={ORANGE}
      >
        Ø30
      </Label>
      <TitleBlock rm={rm} no="25 600 028 B" title="TRAY · 48V" delay={3.3} />
    </g>
  );
}

// ------------------------------------------------------------------------------------------- 2 · connection layout
function SceneLayout({ rm }: P) {
  const cells = Array.from({ length: 24 }, (_, n) => ({
    r: Math.floor(n / 6),
    c: n % 6,
    n,
  }));
  const X0 = 120,
    Y0 = 30,
    W = 20,
    H = 29;
  return (
    <g fill="none" strokeLinejoin="round">
      <defs>
        <pattern
          id="tray-hatch"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" stroke={DIM} strokeWidth="0.7" />
        </pattern>
      </defs>
      <motion.rect
        x="108"
        y="22"
        width="144"
        height="136"
        stroke={INK}
        strokeWidth="1.2"
        {...dr(rm, 0)}
      />
      <motion.rect
        x="108"
        y="22"
        width="144"
        height="136"
        fill="url(#tray-hatch)"
        stroke="none"
        {...fd(rm, 0.6)}
      />
      <motion.rect
        x={X0}
        y={Y0}
        width={6 * W}
        height={4 * H + 4}
        fill="#14171b"
        stroke={INK}
        strokeWidth="0.9"
        {...dr(rm, 0.4)}
      />
      <motion.path
        d={`M${X0 + W} ${Y0}v${4 * H + 4}M${X0 + 2 * W} ${Y0}v${4 * H + 4}M${X0 + 3 * W} ${Y0}v${4 * H + 4}M${X0 + 4 * W} ${Y0}v${4 * H + 4}M${X0 + 5 * W} ${Y0}v${4 * H + 4}M${X0} ${Y0 + H}h${6 * W}M${X0} ${Y0 + 2 * H}h${6 * W}M${X0} ${Y0 + 3 * H}h${6 * W}`}
        stroke={DIM}
        strokeWidth="0.6"
        {...dr(rm, 0.9, 1.0)}
      />
      {cells.map(({ r, c, n }) => {
        const x = X0 + c * W,
          y = Y0 + r * H;
        const d = 1.5 + n * 0.035;
        return (
          <g key={n}>
            <motion.rect
              x={x + 6.5}
              y={y + 10}
              width="7"
              height="9"
              rx="2"
              stroke={INK}
              strokeWidth="0.6"
              {...fd(rm, d)}
            />
            <motion.circle
              cx={x + 4.5}
              cy={y + 5}
              r="2"
              stroke={n % 2 ? ORANGE : GREEN}
              strokeWidth="0.9"
              {...fd(rm, d + 0.1)}
            />
            <motion.circle
              cx={x + 15.5}
              cy={y + H - 5}
              r="2"
              stroke={n % 2 ? GREEN : ORANGE}
              strokeWidth="0.9"
              {...fd(rm, d + 0.1)}
            />
          </g>
        );
      })}
      {[0, 1, 2, 3].map((r) => (
        <motion.path
          key={r}
          d={`M${X0 + 15.5} ${Y0 + r * H + H - 5}q${W / 2} 6 ${W - 11} -${H - 10}M${X0 + 3 * W + 15.5} ${Y0 + r * H + H - 5}q${W / 2} 6 ${W - 11} -${H - 10}`}
          stroke={ORANGE}
          strokeWidth="1.1"
          {...dr(rm, 2.4 + r * 0.25, 0.7)}
        />
      ))}
      <motion.path
        d="M108 40H60M252 40h40"
        stroke={DIM}
        strokeWidth="0.6"
        {...dr(rm, 2.9, 0.5)}
      />
      <Label rm={rm} x={58} y={37} anchor="end" delay={3.1} size={6}>
        NEG. TAKE-OFF
      </Label>
      <Label rm={rm} x={294} y={37} delay={3.2} size={6}>
        POS. TAKE-OFF
      </Label>
      <Label rm={rm} x={58} y={96} anchor="end" delay={3.3} size={6}>
        FLIP-TOP VENT
      </Label>
      <Label rm={rm} x={58} y={104} anchor="end" delay={3.3} size={6}>
        PLUG · 24 NOS
      </Label>
      <motion.path
        d="M60 100H120"
        stroke={DIM}
        strokeWidth="0.6"
        {...dr(rm, 3.2, 0.5)}
      />
      <Label
        rm={rm}
        x={180}
        y={17}
        anchor="middle"
        delay={3.0}
        size={6.5}
        fill={ORANGE}
      >
        CONNECTION LAYOUT 48V · AB 8 PzS 720
      </Label>
      <TitleBlock rm={rm} no="25 600 041 A" title="LAYOUT · 48V" delay={3.6} />
    </g>
  );
}

// ------------------------------------------------------------------------------------------- 3 · 3D fit check
function SceneFit({ rm }: P) {
  return (
    <g fill="none" strokeLinejoin="round">
      <motion.rect
        x="64"
        y="64"
        width="170"
        height="82"
        rx="3"
        stroke={ORANGE}
        strokeWidth="1.6"
        {...dr(rm, 0)}
      />
      <motion.path
        d="M64 86h170M64 124h170M122 64v82M177 64v82"
        stroke={DIM}
        strokeWidth="0.9"
        {...dr(rm, 0.4)}
      />
      <motion.path
        d="M234 64l36-18v82l-36 18M64 64l36-18h170"
        stroke={GREEN}
        strokeWidth="1.6"
        {...dr(rm, 0.8)}
      />
      <motion.path
        d="M100 46v82l-36 18"
        stroke={GREEN}
        strokeWidth="0.7"
        strokeDasharray="3 3"
        {...dr(rm, 1.2)}
      />
      {[
        [64, 64],
        [234, 64],
        [234, 146],
        [64, 146],
      ].map(([x, y], n) => (
        <motion.circle
          key={n}
          cx={x}
          cy={y}
          r="3"
          fill={ORANGE}
          stroke="none"
          {...(rm
            ? { initial: false as const }
            : {
                initial: { scale: 0, opacity: 0 },
                animate: { scale: 1, opacity: 1 },
                transition: {
                  delay: 1.5 + n * 0.15,
                  type: "spring" as const,
                  stiffness: 300,
                },
              })}
        />
      ))}
      <HDim rm={rm} x1={64} x2={234} y={162} label="600 mm" delay={2.2} />
      <VDim rm={rm} x={46} y1={64} y2={146} label="400 mm" delay={2.4} />
      <motion.g {...fd(rm, 2.8)}>
        <rect
          x="262"
          y="150"
          width="84"
          height="20"
          rx="10"
          fill={GREEN}
          stroke="none"
        />
        <text
          x="304"
          y="163.5"
          textAnchor="middle"
          fill="#fff"
          fontSize="8.5"
          fontWeight="700"
          fontFamily="Inter,sans-serif"
          stroke="none"
        >
          FIT VERIFIED
        </text>
      </motion.g>
      <TitleBlock rm={rm} no="25 600 028 B" title="FIT CHECK" delay={3.4} />
    </g>
  );
}

// ------------------------------------------------------------------------------------------- 4 · AFS + drain holes
function SceneAfs({ rm }: P) {
  const corners: [number, number][] = [
    [88, 52],
    [272, 52],
    [88, 130],
    [272, 130],
  ];
  return (
    <g fill="none" strokeLinejoin="round">
      <motion.rect
        x="72"
        y="36"
        width="216"
        height="110"
        stroke={INK}
        strokeWidth="1.2"
        {...dr(rm, 0)}
      />
      <motion.rect
        x="80"
        y="44"
        width="200"
        height="94"
        stroke={DIM}
        strokeWidth="0.7"
        {...dr(rm, 0.5)}
      />
      {/* AFS tubing */}
      <motion.path
        d="M120 66H240M240 66v28M240 94H120M120 94v28M120 122H240"
        stroke={GREEN}
        strokeWidth="1.8"
        strokeLinecap="round"
        {...dr(rm, 1.0, 1.6)}
      />
      {[
        [120, 66],
        [240, 66],
        [240, 94],
        [120, 94],
        [120, 122],
        [240, 122],
      ].map(([x, y], n) => (
        <motion.circle
          key={n}
          cx={x}
          cy={y}
          r="3"
          fill="#14171b"
          stroke={GREEN}
          strokeWidth="1.2"
          {...fd(rm, 1.3 + n * 0.2)}
        />
      ))}
      {/* drain holes: corner + middle */}
      {corners.map(([x, y], n) => (
        <Hole key={n} rm={rm} cx={x} cy={y} r={4.2} delay={2.3 + n * 0.15} />
      ))}
      <Hole rm={rm} cx={180} cy={138} r={5} delay={3.0} />
      <motion.path
        d="M276 130L312 112M180 138V160"
        stroke={DIM}
        strokeWidth="0.6"
        {...dr(rm, 3.1, 0.5)}
      />
      <Label rm={rm} x={314} y={112} delay={3.3} size={6}>
        Ø12 CORNER
      </Label>
      <Label rm={rm} x={314} y={120} delay={3.3} size={6}>
        DRAIN
      </Label>
      <Label rm={rm} x={180} y={169} anchor="middle" delay={3.3} size={6}>
        Ø20 MIDDLE DRAIN
      </Label>
      <Label rm={rm} x={246} y={64} delay={3.4} size={6} fill={GREEN}>
        AFS
      </Label>
      <HDim rm={rm} x1={72} x2={288} y={22} label="1030" delay={2.0} />
      <Label rm={rm} x={72} y={188} delay={3.5} size={7} fill={ORANGE}>
        AFS · DRAIN HOLES
      </Label>
      <TitleBlock rm={rm} no="25 600 052 A" title="AFS · DRAIN" delay={3.7} />
    </g>
  );
}

const SCENES = [ScenePlan, SceneLayout, SceneFit, SceneAfs];
const NAMES = [
  "Front & side views",
  "48V connection layout",
  "Fit check",
  "AFS & drain holes",
];

export function TrayShowcase() {
  const rm = !!useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (rm) return;
    const t = setInterval(() => setI((x) => (x + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(t);
  }, [rm]);
  const Scene = SCENES[i];
  return (
    <div
      aria-hidden="true"
      className="relative z-10 my-4 aspect-[360/200] overflow-hidden rounded-2xl border border-white/10 bg-[#14171b] [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:20px_20px]"
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 360 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* CAD border marks */}
        <path
          d="M6 14V6h8M346 6h8v8M354 186v8h-8M14 194H6v-8"
          fill="none"
          stroke={DIM}
          strokeWidth="0.8"
        />
        <AnimatePresence mode="wait">
          <motion.g
            key={i}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Scene rm={rm} />
          </motion.g>
        </AnimatePresence>
      </svg>
      <div className="absolute top-2.5 left-4 flex items-center gap-2 text-[9px] font-bold tracking-wider text-white/45 uppercase">
        {NAMES[i]}
      </div>
      <div className="absolute right-4 bottom-2.5 flex gap-1.5">
        {SCENES.map((_, n) => (
          <span
            key={n}
            className={`h-1 rounded-full transition-all duration-300 ${n === i ? "w-5 bg-brand" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>
      {!rm && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 h-11 bg-gradient-to-b from-transparent via-brand/25 to-transparent"
          animate={{ top: ["-20%", "100%", "-20%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}