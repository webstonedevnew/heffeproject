import type { CSSProperties } from "react";

/**
 * Surreal, on-palette wallpaper behind everything. Pure inline SVG — no
 * third-party assets (GDPR), no client JS. Soft colour orbs (radial gradients,
 * cheap — no blur/turbulence filters), plus drifting outline doodles: orbits,
 * a sine wave, a single surreal "eye", a dashed moon, scattered marks.
 *
 * Pass `animated={false}` to hold everything perfectly still (used on the
 * sign-in / invite pages, especially for phones).
 *
 * Colours are literal hex (no dark mode) because CSS var() doesn't resolve
 * inside SVG presentation attributes across all browsers.
 */
const INK_FAINT = "#8d8479";
const ACCENT = "#7c2d2d";
const SAGE = "#3d6b4f";
const GOLD = "#9a7b2d";

export function DecorativeBackground({ animated = true }: { animated?: boolean }) {
  // Drift one shape: translate + rotate forever (CSS transform — GPU cheap).
  const drift = (
    dx: number,
    dy: number,
    dr: number,
    dur: number,
    delay = 0
  ): CSSProperties =>
    animated
      ? ({
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: `drift ${dur}s ease-in-out ${delay}s infinite`,
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          "--dr": `${dr}deg`,
        } as CSSProperties)
      : {};

  const slowSpin = (dur: number): CSSProperties =>
    animated
      ? ({
          transformBox: "fill-box",
          transformOrigin: "center",
          animation: `spin ${dur}s linear infinite`,
        } as CSSProperties)
      : {};

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {(
            [
              ["g-accent", ACCENT],
              ["g-sage", SAGE],
              ["g-gold", GOLD],
            ] as const
          ).map(([id, c]) => (
            <radialGradient key={id} id={id} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.55" />
              <stop offset="60%" stopColor={c} stopOpacity="0.18" />
              <stop offset="100%" stopColor={c} stopOpacity="0" />
            </radialGradient>
          ))}
          <linearGradient id="g-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ACCENT} />
            <stop offset="100%" stopColor={SAGE} />
          </linearGradient>
        </defs>

        {/* Soft colour orbs — the washes. Larger and bolder than before. */}
        <g>
          <circle cx="180" cy="120" r="340" fill="url(#g-accent)" opacity="0.5" />
          <circle cx="1330" cy="760" r="420" fill="url(#g-sage)" opacity="0.5" />
          <circle cx="1300" cy="150" r="240" fill="url(#g-gold)" opacity="0.55" />
          <circle cx="90" cy="840" r="260" fill="url(#g-sage)" opacity="0.4" />
          <circle cx="760" cy="-40" r="300" fill="url(#g-accent)" opacity="0.28" />
        </g>

        {/* A big faint guide-circle, like an unfinished orbit. */}
        <circle
          cx="1080" cy="470" r="300"
          fill="none" stroke={INK_FAINT} strokeOpacity="0.12" strokeWidth="1.5"
          strokeDasharray="2 14" style={slowSpin(120)}
        />

        {/* Concentric orbit rings with a planet dot. */}
        <g fill="none" strokeWidth="1.5" style={drift(20, -16, 12, 26)}>
          <circle cx="1150" cy="430" r="44" stroke={ACCENT} strokeOpacity="0.22" />
          <circle cx="1150" cy="430" r="80" stroke={ACCENT} strokeOpacity="0.12" />
          <circle cx="1150" cy="350" r="7" fill={ACCENT} fillOpacity="0.32" stroke="none" />
        </g>

        {/* A long sine wave drifting across the lower third. */}
        <path
          d="M-40 640 q60 -70 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0"
          fill="none" stroke="url(#g-stroke)" strokeOpacity="0.22" strokeWidth="2"
          style={drift(0, 14, 0, 30, 1)}
        />

        {/* A single surreal eye — almond + iris + lashes. */}
        <g style={drift(-12, 10, 0, 24, 2)} stroke={ACCENT} fill="none">
          <path d="M360 200 q60 -52 120 0 q-60 52 -120 0 Z" strokeOpacity="0.3" strokeWidth="1.5" />
          <circle cx="420" cy="200" r="16" stroke={GOLD} strokeOpacity="0.4" strokeWidth="1.5" />
          <circle cx="420" cy="200" r="5" fill={ACCENT} fillOpacity="0.35" stroke="none" />
          <path d="M420 168 v-10 M392 176 l-7 -7 M448 176 l7 -7" strokeOpacity="0.25" strokeWidth="1.5" />
        </g>

        {/* Surreal floating triangle. */}
        <path
          d="M250 470 L300 560 L200 560 Z"
          fill="none" stroke={GOLD} strokeOpacity="0.3" strokeWidth="1.5"
          style={drift(14, 18, 16, 22, 1)}
        />

        {/* A dashed crescent moon. */}
        <path
          d="M980 690 a52 52 0 1 1 -34 -92 a40 40 0 1 0 34 92 Z"
          fill={GOLD} fillOpacity="0.08" stroke={GOLD} strokeOpacity="0.28"
          strokeWidth="1.5" strokeDasharray="3 7" style={drift(-10, -12, -10, 28, 2)}
        />

        {/* Tiny plus-marks scattered like stars. */}
        <g stroke={INK_FAINT} strokeOpacity="0.32" strokeWidth="1.5">
          <path d="M650 110 v14 M643 117 h14" style={drift(6, -8, 0, 12)} />
          <path d="M1230 560 v12 M1224 566 h12" style={drift(-6, 8, 0, 14, 1)} />
          <path d="M300 700 v12 M294 706 h12" style={drift(8, 8, 0, 16, 2)} />
          <path d="M560 760 v10 M555 765 h10" style={drift(-7, -6, 0, 13, 1)} />
          <path d="M1120 120 v10 M1115 125 h10" style={drift(5, 7, 0, 15, 2)} />
        </g>

        {/* A few solid dots. */}
        <g fill={SAGE} fillOpacity="0.22">
          <circle cx="720" cy="300" r="4" style={drift(0, -10, 0, 18)} />
          <circle cx="540" cy="430" r="3" style={drift(8, 6, 0, 20, 1)} />
          <circle cx="860" cy="540" r="5" style={drift(-8, 8, 0, 22, 2)} />
        </g>
      </svg>
    </div>
  );
}
