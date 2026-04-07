// ─── Nebula Background ────────────────────────────────────────────────────────
// CSS-based deep-slate/cyan nebula. Transitions to Ace-Gold at VIP 5.
// Pure CSS — zero JS animation cost, zero bundle overhead.
// Using Three.js/React-Three-Fiber would add ~280KB gzipped to the bundle,
// which degrades load time on every shift start. This CSS approach is indistinguishable
// visually and costs nothing.

export default function NebulaBackground({ vipLevel = 0 }) {
  const isGold = vipLevel >= 5;

  const palette = isGold
    ? {
        a: 'rgba(250,204,21,0.10)',  // Ace yellow
        b: 'rgba(251,146,60,0.07)',  // amber
        c: 'rgba(239,68,68,0.04)',   // red hint
      }
    : {
        a: 'rgba(6,182,212,0.09)',   // cyan
        b: 'rgba(99,102,241,0.06)',  // indigo
        c: 'rgba(15,23,42,0.00)',    // transparent
      };

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      {/* Primary nebula cloud */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 90% 60% at 15% 25%, ${palette.a} 0%, transparent 65%),
            radial-gradient(ellipse 70% 90% at 85% 75%, ${palette.b} 0%, transparent 65%),
            radial-gradient(ellipse 50% 70% at 55% 50%, ${palette.c} 0%, transparent 65%)
          `,
          animation: 'nebula-drift 25s ease-in-out infinite alternate',
          transition: 'background 2s ease',
        }}
      />
      {/* Secondary shimmer layer */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse 40% 40% at 70% 20%, ${palette.a} 0%, transparent 60%)`,
          animation: 'nebula-drift 18s ease-in-out infinite alternate-reverse',
        }}
      />
      <style>{`
        @keyframes nebula-drift {
          0%   { transform: scale(1.00) translate(0px,   0px); }
          25%  { transform: scale(1.02) translate(-10px,  5px); }
          50%  { transform: scale(0.99) translate(8px,  -8px); }
          75%  { transform: scale(1.01) translate(-5px,  10px); }
          100% { transform: scale(1.03) translate(6px,  -4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="nebula-drift"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
