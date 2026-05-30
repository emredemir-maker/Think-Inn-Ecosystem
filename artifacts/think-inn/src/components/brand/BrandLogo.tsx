import { useId } from "react";

/* ════════════════════════════════════════════════════════════════════════
   think-Inn marka logosu — ekteki logonun birebir, ölçeklenebilir inline SVG'si.
   Parçalar:
   • BrandMark   → ağ-düğüm ikonu (hexagon içinde 3 düğüm + merkez), gradient
   • Wordmark    → "think-" + hexagon içinde "Inn"
   • BrandLogo   → ikon + wordmark + "AI INNOVATION ECOSYSTEM" tagline (yatay kilit)
   Renkler marka token'larıyla aynı: cyan #18C9E8 · mavi #1463F3 · mor #7A5CFF.
   ════════════════════════════════════════════════════════════════════════ */

const CYAN = "#18C9E8";
const BLUE = "#1463F3";
const VIOLET = "#7A5CFF";

/** Ağ-düğüm ikonu. dark=true → koyu navy zeminli (app icon / favicon hissi). */
export function BrandMark({
  size = 42,
  className = "",
  dark = false,
}: { size?: number; className?: string; dark?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const g = `tiG-${uid}`;
  const nodeFill = dark ? "#0B1A33" : "#FFFFFF";
  // Pointy-top hexagon, merkez (32,32), R=27 → tepe (cyan), sol-alt (mavi), sağ-alt (mor) düğümleri
  const TOP = [32, 5] as const;
  const LL = [8.6, 45.5] as const;
  const LR = [55.4, 45.5] as const;
  const C = [32, 32] as const;
  const hex = "32,5 55.4,18.5 55.4,45.5 32,59 8.6,45.5 8.6,18.5";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="think-Inn"
    >
      <defs>
        <linearGradient id={g} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={CYAN} />
          <stop offset="0.52" stopColor={BLUE} />
          <stop offset="1" stopColor={VIOLET} />
        </linearGradient>
      </defs>

      {dark && <rect x="2" y="2" width="60" height="60" rx="15" fill="#0B1A33" />}

      {/* Hexagon dış hat */}
      <polygon points={hex} stroke={`url(#${g})`} strokeWidth="2.6" strokeLinejoin="round" opacity={dark ? 0.5 : 0.42} />

      {/* Merkez düğümden spoke'lar */}
      <g stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" opacity="0.6">
        <line x1={C[0]} y1={C[1]} x2={TOP[0]} y2={TOP[1]} />
        <line x1={C[0]} y1={C[1]} x2={LL[0]} y2={LL[1]} />
        <line x1={C[0]} y1={C[1]} x2={LR[0]} y2={LR[1]} />
      </g>

      {/* Halka düğümler — tepe cyan, sol-alt mavi, sağ-alt mor */}
      <circle cx={TOP[0]} cy={TOP[1]} r="5.4" fill={nodeFill} stroke={CYAN} strokeWidth="3.2" />
      <circle cx={LL[0]} cy={LL[1]} r="5.4" fill={nodeFill} stroke={BLUE} strokeWidth="3.2" />
      <circle cx={LR[0]} cy={LR[1]} r="5.4" fill={nodeFill} stroke={VIOLET} strokeWidth="3.2" />

      {/* Merkez dolu düğüm */}
      <circle cx={C[0]} cy={C[1]} r="6.4" fill={`url(#${g})`} />
    </svg>
  );
}

/** "think-" + hexagon içinde "Inn" wordmark'ı. onDark=true → koyu zeminde beyaz. */
export function Wordmark({ fontSize = 21, onDark = false }: { fontSize?: number; onDark?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const g = `tiHex-${uid}`;
  return (
    <span className="ti-word" style={{ fontSize }}>
      <span className="ti-think" style={onDark ? { color: "#FFFFFF" } : undefined}>think-</span>
      <span
        className="ti-hex"
        style={{ width: fontSize * 1.72, height: fontSize * 1.4 }}
      >
        <svg className="ti-hex-svg" viewBox="0 0 100 86" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id={g} x1="0" y1="0" x2="100" y2="86" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={CYAN} />
              <stop offset="0.55" stopColor={BLUE} />
              <stop offset="1" stopColor={VIOLET} />
            </linearGradient>
          </defs>
          <polygon points="25,4 75,4 97,43 75,82 25,82 3,43" fill="none" stroke={`url(#${g})`} strokeWidth="6" strokeLinejoin="round" />
        </svg>
        <span className="ti-inn" style={onDark ? { color: "#FFFFFF" } : undefined}>Inn</span>
      </span>
    </span>
  );
}

/** Yatay kilit: ikon + wordmark + tagline. */
export function BrandLogo({
  size = "md",
  showTagline = true,
  onDark = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  onDark?: boolean;
  className?: string;
}) {
  const markPx = size === "lg" ? 54 : size === "sm" ? 34 : 42;
  const fs = size === "lg" ? 31 : size === "sm" ? 17.5 : 21;
  return (
    <span className={"ti-logo " + className}>
      <BrandMark size={markPx} dark={false} />
      <span className="ti-lockup">
        <Wordmark fontSize={fs} onDark={onDark} />
        {showTagline && (
          <span
            className="ti-tagline"
            style={{ fontSize: Math.max(6, fs * 0.285), color: onDark ? "rgba(255,255,255,0.72)" : "#5A6B86" }}
          >
            AI INNOVATION ECOSYSTEM
          </span>
        )}
      </span>
    </span>
  );
}

export default BrandLogo;
