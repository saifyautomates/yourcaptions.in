// A polished loading indicator used in place of generic spinners across the
// app. Three nested elements — a scanning gradient arc, a slow-orbiting
// particle ring, and a pulsing core — all keyed off the primary token, so it
// re-themes automatically.
//
// Purely CSS/SVG driven (no framer-motion) so it renders instantly and stays
// cheap even when many instances sit on-screen (batch upload list, dashboard
// status chips, etc.).

interface Props {
  /** 16 | 20 | 28 | 44 | 72 px, default 44. */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Short line rendered under the loader (e.g. "Transcribing…"). */
  label?: string;
  /** Additional wrapper classes. */
  className?: string;
  /** Compact inline layout — no label, minimal padding. */
  inline?: boolean;
}

const PX: Record<NonNullable<Props["size"]>, number> = {
  xs: 16, sm: 20, md: 28, lg: 44, xl: 72,
};

export function FuturisticLoader({ size = "lg", label, className = "", inline }: Props) {
  const px = PX[size];
  const stroke = Math.max(1.25, px / 22);
  const r1 = px / 2 - stroke;
  const r2 = r1 - stroke * 1.75;
  const c = px / 2;
  const dash = 2 * Math.PI * r1;
  const gid = `flg-${size}`;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      className={`inline-flex ${inline ? "items-center gap-2" : "flex-col items-center gap-2"} ${className}`}
    >
      <span
        className="relative inline-block"
        style={{ width: px, height: px }}
      >
        {/* Soft ambient glow */}
        <span
          aria-hidden
          className="absolute inset-0 rounded-full blur-md opacity-60"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.55) 0%, transparent 65%)" }}
        />
        <svg
          viewBox={`0 0 ${px} ${px}`}
          width={px}
          height={px}
          className="relative"
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              <stop offset="45%" stopColor="hsl(var(--primary))" stopOpacity="1" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="1" />
            </linearGradient>
          </defs>
          {/* Faint base ring */}
          <circle
            cx={c} cy={c} r={r1}
            fill="none"
            stroke="hsl(var(--primary) / 0.15)"
            strokeWidth={stroke}
          />
          {/* Scanning arc */}
          <circle
            cx={c} cy={c} r={r1}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash * 0.35} ${dash}`}
            style={{
              transformOrigin: `${c}px ${c}px`,
              animation: "flg-spin 1.15s cubic-bezier(.6,.15,.4,.85) infinite",
            }}
          />
          {/* Inner counter-rotating dashed ring */}
          <circle
            cx={c} cy={c} r={r2}
            fill="none"
            stroke="hsl(var(--primary) / 0.65)"
            strokeWidth={Math.max(0.75, stroke * 0.6)}
            strokeDasharray={`${dash * 0.03} ${dash * 0.08}`}
            style={{
              transformOrigin: `${c}px ${c}px`,
              animation: "flg-spin-rev 2.6s linear infinite",
            }}
          />
          {/* Orbiting particles */}
          <g style={{ transformOrigin: `${c}px ${c}px`, animation: "flg-spin 2s linear infinite" }}>
            <circle cx={c} cy={stroke * 0.8} r={stroke * 0.9} fill="hsl(var(--primary))" />
          </g>
          <g style={{ transformOrigin: `${c}px ${c}px`, animation: "flg-spin-rev 1.6s linear infinite" }}>
            <circle cx={px - stroke * 0.8} cy={c} r={stroke * 0.6} fill="hsl(var(--primary) / 0.75)" />
          </g>
          {/* Pulsing core */}
          <circle
            cx={c} cy={c} r={Math.max(1.2, px / 12)}
            fill="hsl(var(--primary))"
            style={{ animation: "flg-pulse 1.4s ease-in-out infinite" }}
          />
        </svg>
      </span>
      {label && (
        <span
          className={`${inline ? "text-xs" : "text-[11px] uppercase tracking-[0.18em]"} font-medium text-muted-foreground`}
        >
          {label}
          {!inline && (
            <span className="ml-0.5 inline-flex">
              <span style={{ animation: "flg-dot 1.4s ease-in-out infinite" }}>.</span>
              <span style={{ animation: "flg-dot 1.4s ease-in-out 0.2s infinite" }}>.</span>
              <span style={{ animation: "flg-dot 1.4s ease-in-out 0.4s infinite" }}>.</span>
            </span>
          )}
        </span>
      )}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default FuturisticLoader;
