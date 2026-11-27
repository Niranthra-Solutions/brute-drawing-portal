import { useEffect, useMemo, useState } from "react";
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

function gearPath(cx: number, cy: number, r: number, teeth: number) {
  const depth = r * 0.16;
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let t = 0; t < teeth; t++) {
    const a = t * step;
    const seq: [number, number][] = [
      [a, r - depth],
      [a + step * 0.18, r],
      [a + step * 0.5, r],
      [a + step * 0.68, r - depth],
    ];
    for (const [ang, rad] of seq) {
      pts.push(`${cx + Math.cos(ang) * rad},${cy + Math.sin(ang) * rad}`);
    }
  }
  const hole = r * 0.38;
  return (
    `M${pts.join("L")}Z` +
    `M${cx + hole},${cy}a${hole},${hole} 0 1,0 ${-hole * 2},0a${hole},${hole} 0 1,0 ${hole * 2},0Z`
  );
}

function Gear({
  cx,
  cy,
  r,
  teeth,
  color,
  opacity,
  seconds,
  reverse,
}: {
  cx: number;
  cy: number;
  r: number;
  teeth: number;
  color: string;
  opacity: number;
  seconds: number;
  reverse?: boolean;
}) {
  const d = useMemo(() => gearPath(cx, cy, r, teeth), [cx, cy, r, teeth]);
  return (
    <g
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        animation: `login-spin ${seconds}s linear infinite ${reverse ? "reverse" : "normal"}`,
      }}
    >
      <path d={d} fill={color} fillOpacity={opacity} fillRule="evenodd" />
      <circle
        cx={cx}
        cy={cy}
        r={r * 0.56}
        fill="none"
        stroke={color}
        strokeOpacity={opacity * 0.9}
        strokeWidth="2"
      />
    </g>
  );
}

const SKYLINE: [number, number, number][] = [
  [0, 70, 90],
  [90, 110, 60],
  [150, 85, 120],
  [270, 130, 70],
  [340, 95, 100],
  [440, 120, 80],
  [520, 80, 140],
  [660, 110, 75],
  [735, 100, 110],
  [835, 130, 65],
  [900, 90, 130],
  [1030, 120, 85],
  [1115, 85, 105],
  [1220, 110, 70],
  [1290, 100, 120],
  [1410, 130, 80],
];

export function LoginBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <style>{`
        @keyframes login-spin { to { transform: rotate(360deg); } }
        @keyframes login-twinkle { 0%,100% { opacity:.25 } 50% { opacity:1 } }
        @keyframes login-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-14px) } }
        @media (prefers-reduced-motion: reduce) {
          .login-anim, .login-anim * { animation: none !important; }
        }
      `}</style>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(224,106,44,.30),transparent_45%),radial-gradient(circle_at_55%_70%,rgba(224,106,44,.14),transparent_40%),radial-gradient(circle_at_0%_100%,rgba(95,168,80,.20),transparent_40%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,.07)_1px,transparent_1px)] [background-size:24px_24px]" />
      <svg
        className="login-anim absolute bottom-0 left-0 h-[32%] w-full"
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
      >
        <Gear
          cx={430}
          cy={250}
          r={150}
          teeth={22}
          color="#8b95a3"
          opacity={0.2}
          seconds={90}
        />
        <Gear
          cx={720}
          cy={300}
          r={105}
          teeth={16}
          color={ORANGE}
          opacity={0.38}
          seconds={62}
          reverse
        />
        <Gear
          cx={1010}
          cy={235}
          r={125}
          teeth={19}
          color="#8b95a3"
          opacity={0.18}
          seconds={76}
        />
        <Gear
          cx={90}
          cy={120}
          r={52}
          teeth={11}
          color="#8b95a3"
          opacity={0.22}
          seconds={40}
          reverse
        />
        <Gear
          cx={1340}
          cy={90}
          r={42}
          teeth={10}
          color={ORANGE}
          opacity={0.3}
          seconds={34}
        />
        <g fill="#0b0d10" fillOpacity=".92">
          {SKYLINE.map(([x, w, h], n) => (
            <rect key={n} x={x} y={420 - h} width={w} height={h} />
          ))}
        </g>
        <g fill={ORANGE} fillOpacity=".75">
          {SKYLINE.flatMap(([x, w, h], n) =>
            [0, 1, 2].map((k) => (
              <rect
                key={`${n}-${k}`}
                x={x + 14 + k * ((w - 28) / 3)}
                y={420 - h + 16 + ((n + k) % 3) * 18}
                width="9"
                height="7"
                style={{
                  animation: `login-twinkle ${2.4 + ((n * 3 + k) % 5) * 0.7}s ease-in-out ${(n + k) * 0.35}s infinite`,
                }}
              />
            )),
          )}
        </g>
      </svg>
      <div
        className="login-anim absolute top-[16%] right-[39%] hidden size-16 rounded-full border-[6px] border-white/10 lg:block"
        style={{ animation: "login-float 7s ease-in-out infinite" }}
      />
      <div
        className="login-anim absolute bottom-[34%] left-[2%] hidden size-14 rotate-45 rounded-xl border-[5px] border-white/10 lg:block"
        style={{ animation: "login-float 9s ease-in-out 1s infinite" }}
      />
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