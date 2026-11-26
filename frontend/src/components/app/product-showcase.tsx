import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SLIDES_DATA } from "./showcase-images";

/**
 * Login-screen animation: the real Amaron Brute battery + truck photos, one slide after another
 * (neon frame draws, battery slides in, truck drives in, spec pill and truck tag pop up).
 * "Reduce motion" shows the first slide, static.
 */

const GREEN = "#5FD13A";
const ORANGE = "#F26B1D";
const SLIDE_MS = 3800;

const SLIDES = SLIDES_DATA;

export function ProductShowcase() {
  const rm = !!useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (rm) return;
    const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(t);
  }, [rm]);
  const s = SLIDES[i];
  const anim = (props: object, delay: number) =>
    rm
      ? { initial: false as const }
      : {
          ...props,
          transition: { delay, duration: 0.6, ease: "easeOut" as const },
        };
  return (
    <div
      aria-hidden="true"
      className="relative z-10 my-4 aspect-[360/190] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(ellipse_at_40%_45%,#1a2c3d,#07111b_70%)]"
    >
      <svg
        className="absolute inset-0 size-full"
        viewBox="0 0 360 190"
        preserveAspectRatio="xMidYMid meet"
      >
        <motion.rect
          x="6"
          y="6"
          width="348"
          height="178"
          rx="12"
          fill="none"
          stroke={GREEN}
          strokeWidth="2"
          {...(rm
            ? { initial: false as const }
            : {
                initial: { pathLength: 0 },
                animate: { pathLength: 1 },
                transition: { duration: 1.6 },
              })}
        />
        <path
          d="M6 30V18q0-12 12-12h16M354 160v6q0 12-12 12h-16"
          fill="none"
          stroke={ORANGE}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <AnimatePresence mode="wait">
          <motion.g
            key={i}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.35 }}
          >
            {/* battery slides in from the left */}
            <motion.g
              {...anim(
                {
                  initial: { opacity: 0, x: -50 },
                  animate: { opacity: 1, x: 0 },
                },
                0.15,
              )}
            >
              <image
                href={s.battery}
                x="14"
                y="16"
                width="204"
                height="150"
                preserveAspectRatio="xMidYMid meet"
              />
            </motion.g>
            {/* truck drives in from the right */}
            <motion.g
              {...anim(
                {
                  initial: { opacity: 0, x: 60 },
                  animate: { opacity: 1, x: 0 },
                },
                0.45,
              )}
            >
              <image
                href={s.truck}
                x="226"
                y="18"
                width="122"
                height="100"
                preserveAspectRatio="xMidYMid meet"
              />
            </motion.g>
            <motion.g
              {...anim(
                {
                  initial: { opacity: 0, x: 30 },
                  animate: { opacity: 1, x: 0 },
                },
                1.1,
              )}
            >
              <path d="M232 128h116l-6 24H226z" fill={ORANGE} />
              <text
                x="286"
                y="145"
                textAnchor="middle"
                fontSize="12"
                fontWeight="800"
                fontStyle="italic"
                fill="#fff"
                fontFamily="Inter,sans-serif"
              >
                {s.tag}
              </text>
            </motion.g>
          </motion.g>
        </AnimatePresence>
      </svg>
      <div className="absolute bottom-2.5 left-4 flex gap-1.5">
        {SLIDES.map((_, n) => (
          <span
            key={n}
            className={`h-1 rounded-full transition-all duration-300 ${n === i ? "w-5 bg-brand" : "w-1.5 bg-white/25"}`}
          />
        ))}
      </div>
    </div>
  );
}