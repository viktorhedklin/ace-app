// ─── Nebula Background ────────────────────────────────────────────────────────
// CSS-based deep-slate/cyan nebula. Transitions through VIP tiers:
//   VIP 0-3: Deep cyan/indigo nebula (default)
//   VIP 4:   Solar Flare — warm amber/gold transition
//   VIP 5:   Full Ace-Gold — intense gold/crimson
// Pure CSS — zero JS animation cost, zero bundle overhead.

import { useAce } from '@/context/AceContext';
import { useState, useEffect } from 'react';

export default function NebulaBackground({ vipLevel = 0 }) {
  const { nebulaHeartbeat } = useAce();
  const [beating, setBeating] = useState(false);

  // Trigger heartbeat animation when signal increments
  useEffect(() => {
    if (!nebulaHeartbeat) return;
    setBeating(true);
    const t = setTimeout(() => setBeating(false), 2000);
    return () => clearTimeout(t);
  }, [nebulaHeartbeat]);
  // VIP 4-5: Solar Flare → Full Gold. Everyone else: default nebula.
  const tier = vipLevel >= 5 ? 'gold' : vipLevel >= 4 ? 'flare' : 'default';

  const palettes = {
    default: {
      a: 'rgba(6,182,212,0.09)',    // cyan
      b: 'rgba(99,102,241,0.06)',   // indigo
      c: 'rgba(15,23,42,0.00)',     // transparent
      shimmer: 'rgba(6,182,212,0.06)',
      speed: '25s',
    },
    flare: {
      a: 'rgba(251,191,36,0.10)',   // amber-400
      b: 'rgba(245,158,11,0.07)',   // amber-500
      c: 'rgba(217,119,6,0.04)',    // amber-600 hint
      shimmer: 'rgba(251,191,36,0.08)',
      speed: '20s',
    },
    gold: {
      a: 'rgba(250,204,21,0.14)',   // Ace yellow — intense
      b: 'rgba(251,146,60,0.10)',   // orange
      c: 'rgba(239,68,68,0.06)',    // red hint
      shimmer: 'rgba(250,204,21,0.10)',
      speed: '16s',
    },
  };

  const p = palettes[tier];

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
            radial-gradient(ellipse 90% 60% at 15% 25%, ${p.a} 0%, transparent 65%),
            radial-gradient(ellipse 70% 90% at 85% 75%, ${p.b} 0%, transparent 65%),
            radial-gradient(ellipse 50% 70% at 55% 50%, ${p.c} 0%, transparent 65%)
          `,
          animation: `nebula-drift ${p.speed} ease-in-out infinite alternate`,
          transition: 'background 2s ease',
        }}
      />
      {/* Secondary shimmer layer */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          background: `radial-gradient(ellipse 40% 40% at 70% 20%, ${p.shimmer} 0%, transparent 60%)`,
          animation: `nebula-drift 18s ease-in-out infinite alternate-reverse`,
          transition: 'background 2s ease',
        }}
      />
      {/* VIP 4-5: tertiary pulse layer for depth */}
      {tier !== 'default' && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 40% 60%, ${p.b} 0%, transparent 55%)`,
            animation: 'nebula-pulse 8s ease-in-out infinite',
            opacity: tier === 'gold' ? 0.6 : 0.35,
            transition: 'opacity 2s ease',
          }}
        />
      )}
      {/* Heartbeat layer — friction alert */}
      {beating && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(239,68,68,0.12) 0%, transparent 60%)',
            animation: 'nebula-heartbeat 0.8s ease-out 2',
          }}
        />
      )}
      <style>{`
        @keyframes nebula-heartbeat {
          0%   { opacity: 0; transform: scale(0.95); }
          30%  { opacity: 1; transform: scale(1.02); }
          100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes nebula-drift {
          0%   { transform: scale(1.00) translate(0px,   0px); }
          25%  { transform: scale(1.02) translate(-10px,  5px); }
          50%  { transform: scale(0.99) translate(8px,  -8px); }
          75%  { transform: scale(1.01) translate(-5px,  10px); }
          100% { transform: scale(1.03) translate(6px,  -4px); }
        }
        @keyframes nebula-pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.05); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="nebula-drift"], [style*="nebula-pulse"], [style*="nebula-heartbeat"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
