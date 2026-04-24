// ─── ShimmerBlock ─────────────────────────────────────────────────────────────
// Skeleton placeholder with kinetic shimmer animation.
// Flow direction matches the nebula drift (left-to-right, slight diagonal).

export default function ShimmerBlock({ className = '', width = 'w-full', height = 'h-4', rounded = 'rounded-lg' }) {
  return (
    <div
      className={`${width} ${height} ${rounded} overflow-hidden bg-bg-2/80 ${className}`}
      aria-hidden="true"
      role="presentation"
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(105deg, transparent 35%, rgba(148,163,184,0.10) 50%, rgba(203,213,225,0.06) 55%, transparent 65%)',
          backgroundSize: '250% 100%',
          animation: 'ace-shimmer 1.8s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes ace-shimmer {
          0%   { background-position: 250% 0; }
          100% { background-position: -50% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="ace-shimmer"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

// Preset compositions for common loading states
export function ShimmerMessage() {
  return (
    <div className="flex gap-2.5 justify-start">
      <div className="w-6 h-6 rounded-full bg-bg-2/80 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-2 flex-1 max-w-[65%]">
        <ShimmerBlock height="h-3" width="w-3/4" />
        <ShimmerBlock height="h-3" width="w-full" />
        <ShimmerBlock height="h-3" width="w-1/2" />
      </div>
    </div>
  );
}

export function ShimmerCard() {
  return (
    <div className="bg-bg-1 border border-border-0 rounded-xl p-4 space-y-3">
      <ShimmerBlock height="h-4" width="w-1/3" />
      <ShimmerBlock height="h-3" width="w-full" />
      <ShimmerBlock height="h-3" width="w-4/5" />
    </div>
  );
}
