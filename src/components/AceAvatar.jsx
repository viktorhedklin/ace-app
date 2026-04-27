import { motion, AnimatePresence } from 'framer-motion';

/**
 * ACE's visual identity in chat. A 4-point diamond spark in hero yellow.
 * Animates per state:
 *
 *   idle       — single soft glow. Calm, no motion.
 *   thinking   — rapid flicker + downward particle trail while waiting for
 *                first token. Replaces the stock three-dot typing indicator.
 *   streaming  — breathing glow + slow inner rotation while tokens stream.
 *   celebrated — brief gold bloom + scale pop on thumbs-up.
 *   flagged    — single red pulse on thumbs-down.
 *
 * Props:
 *   size      — px dimension (default 28)
 *   state     — 'idle' | 'thinking' | 'streaming' | 'celebrated' | 'flagged'
 *   className — optional wrapper classes
 *
 * Back-compat: `streaming` boolean maps to state='streaming' if state not set.
 */
export default function AceAvatar({ size = 28, state, streaming = false, className = '' }) {
  const px = size;
  const effectiveState = state || (streaming ? 'streaming' : 'idle');

  // Glow color + intensity per state
  const glowConfig = {
    idle:       { color: 'rgba(250,204,21,0.10)', spread: '12px' },
    thinking:   { color: 'rgba(250,204,21,0.22)', spread: '14px' },
    streaming:  { color: 'rgba(250,204,21,0.22)', spread: '16px' },
    celebrated: { color: 'rgba(250,204,21,0.65)', spread: '28px' },
    flagged:    { color: 'rgba(239,68,68,0.45)',  spread: '20px' },
  }[effectiveState];

  // Glow animation per state
  const glowAnimate =
    effectiveState === 'streaming' ? { boxShadow: [
      '0 0 8px rgba(250,204,21,0.12)',
      '0 0 16px rgba(250,204,21,0.32)',
      '0 0 8px rgba(250,204,21,0.12)',
    ]}
    : effectiveState === 'thinking' ? { boxShadow: [
      '0 0 6px rgba(250,204,21,0.12)',
      '0 0 14px rgba(250,204,21,0.30)',
      '0 0 6px rgba(250,204,21,0.12)',
    ]}
    : effectiveState === 'celebrated' ? { boxShadow: [
      '0 0 10px rgba(250,204,21,0.20)',
      '0 0 30px rgba(250,204,21,0.70)',
      '0 0 12px rgba(250,204,21,0.25)',
    ], scale: [1, 1.12, 1] }
    : effectiveState === 'flagged' ? { boxShadow: [
      '0 0 10px rgba(250,204,21,0.10)',
      '0 0 22px rgba(239,68,68,0.50)',
      '0 0 10px rgba(250,204,21,0.10)',
    ]}
    : { boxShadow: `0 0 ${glowConfig.spread} ${glowConfig.color}` };

  const glowTransition =
    effectiveState === 'streaming' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
    : effectiveState === 'thinking' ? { duration: 0.7, repeat: Infinity, ease: 'easeInOut' }
    : effectiveState === 'celebrated' ? { duration: 0.85, ease: 'easeOut' }
    : effectiveState === 'flagged' ? { duration: 0.6, ease: 'easeOut' }
    : { duration: 0.4 };

  // Rotation per state
  const rotate =
    effectiveState === 'streaming' ? 360
    : effectiveState === 'thinking' ? [0, 15, -15, 0]
    : 0;
  const rotateTransition =
    effectiveState === 'streaming' ? { duration: 6, repeat: Infinity, ease: 'linear' }
    : effectiveState === 'thinking' ? { duration: 0.4, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0.4 };

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: px, height: px }}>
      <motion.div
        className="relative rounded-xl flex items-center justify-center overflow-hidden select-none"
        style={{
          width: px,
          height: px,
          background: effectiveState === 'flagged'
            ? 'linear-gradient(135deg, rgba(239,68,68,0.22) 0%, rgba(239,68,68,0.08) 100%)'
            : 'linear-gradient(135deg, rgba(250,204,21,0.28) 0%, rgba(250,204,21,0.12) 100%)',
          border: effectiveState === 'flagged'
            ? '1px solid rgba(239,68,68,0.35)'
            : '1px solid rgba(250,204,21,0.25)',
          backdropFilter: 'blur(6px)',
        }}
        animate={glowAnimate}
        transition={glowTransition}
        aria-label="Ace"
      >
        <motion.svg
          width={px * 0.6}
          height={px * 0.6}
          viewBox="0 0 24 24"
          fill="none"
          animate={{ rotate }}
          transition={rotateTransition}
        >
          <path d="M12 2 L16 12 L12 22 L8 12 Z" fill={effectiveState === 'flagged' ? 'rgba(239,68,68,0.95)' : 'rgba(250,204,21,0.95)'} />
          <path d="M2 12 L8 12 M16 12 L22 12" stroke={effectiveState === 'flagged' ? 'rgba(239,68,68,0.55)' : 'rgba(250,204,21,0.55)'} strokeWidth="1.5" strokeLinecap="round" />
        </motion.svg>
      </motion.div>

      {/* Thinking particles — three dots drop downward from avatar while
          waiting for the first token. Replaces stock three-dot indicator. */}
      <AnimatePresence>
        {effectiveState === 'thinking' && (
          <div
            className="absolute left-1/2 pointer-events-none"
            style={{ top: px - 2, transform: 'translateX(-50%)', width: 20, height: 24 }}
          >
            {[0, 1, 2].map(i => (
              <motion.span
                key={i}
                className="absolute left-1/2 rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  marginLeft: -1.5,
                  background: 'rgba(250,204,21,0.85)',
                  boxShadow: '0 0 6px rgba(250,204,21,0.55)',
                }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: [0, 10, 18], opacity: [0, 0.9, 0] }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  delay: i * 0.28,
                  ease: 'easeIn',
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
