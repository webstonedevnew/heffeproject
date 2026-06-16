import type { CSSProperties } from "react";

/**
 * Surreal, on-palette wallpaper that sits behind everything. Pure inline SVG —
 * no third-party assets (GDPR), no client JS. Soft blurred "ink blots", a few
 * drifting outline shapes and a faint paper grain so the journal feels hand-made
 * rather than templated. Animations are CSS and respect prefers-reduced-motion.
 *
 * Colours are the editorial palette as literal hex (no dark mode), because CSS
 * var() doesn't resolve inside SVG presentation attributes across all browsers.
 */
const INK = "#1f1b16";
const INK_FAINT = "#8d8479";
const ACCENT = "#7c2d2d";
const SAGE = "#3d6b4f";
const GOLD = "#9a7b2d";

export function DecorativeBackground() {
  // Per-shape drift directions, fed to the `drift` keyframes via CSS vars.
  const drift = (
    dx: number,
    dy: number,
    dr: number,
    dur: number,
    delay = 0
  ): CSSProperties =>
    ({
      transformBox: "fill-box", // so transforms rotate the shape in place
      transformOrigin: "center",
      animation: `drift ${dur}s ease-in-out ${delay}s infinite`,
      "--dx": `${dx}px`,
      "--dy": `${dy}px`,
      "--dr": `${dr}deg`,
    }) as CSSProperties;

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
          <filter id="dbg-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="60" />
          </filter>
          <filter id="dbg-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <radialGradient id="dbg-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.5" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft blurred ink-blots — the colour washes (static, for performance). */}
        <g filter="url(#dbg-soft)">
          <circle cx="150" cy="120" r="240" fill={ACCENT} fillOpacity="0.13" />
          <circle cx="1320" cy="760" r="300" fill={SAGE} fillOpacity="0.12" />
          <circle cx="1280" cy="180" r="150" fill={GOLD} fillOpacity="0.14" />
          <circle cx="120" cy="820" r="170" fill={SAGE} fillOpacity="0.1" />
        </g>

        {/* A big faint halo, lower middle. */}
        <circle cx="720" cy="980" r="420" fill="url(#dbg-halo)" />

        {/* Drifting outline shapes — the "surreal" doodles. */}
        <g fill="none" strokeWidth="1.5">
          {/* concentric orbit rings */}
          <g style={drift(18, -14, 10, 26)}>
            <circle cx="1130" cy="430" r="46" stroke={ACCENT} strokeOpacity="0.16" />
            <circle cx="1130" cy="430" r="78" stroke={ACCENT} strokeOpacity="0.1" />
            <circle cx="1130" cy="430" r="6" fill={ACCENT} fillOpacity="0.18" />
          </g>
          {/* a wandering squiggle */}
          <path
            d="M120 520 q40 -60 80 0 t80 0 t80 0 t80 0"
            stroke={SAGE}
            strokeOpacity="0.22"
            style={drift(-14, 12, -6, 30, 1)}
          />
          {/* surreal triangle */}
          <path
            d="M420 150 L470 250 L370 250 Z"
            stroke={GOLD}
            strokeOpacity="0.28"
            style={drift(12, 16, 14, 22, 2)}
          />
          {/* tiny plus marks scattered like stars */}
          <g stroke={INK_FAINT} strokeOpacity="0.3">
            <path d="M640 120 v14 M633 127 h14" style={drift(6, -8, 0, 12)} />
            <path d="M980 660 v12 M974 666 h12" style={drift(-6, 8, 0, 14, 1)} />
            <path d="M300 700 v12 M294 706 h12" style={drift(8, 8, 0, 16, 2)} />
          </g>
          {/* a lone arc, like an eyelid */}
          <path
            d="M520 800 q120 -90 240 0"
            stroke={ACCENT}
            strokeOpacity="0.18"
            style={drift(0, -10, 0, 24, 1)}
          />
        </g>

        {/* Faint paper grain over the top of it all. */}
        <rect width="1440" height="900" fill={INK} filter="url(#dbg-grain)" opacity="0.035" />
      </svg>
    </div>
  );
}
