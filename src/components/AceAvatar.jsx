import { motion } from 'framer-motion';

/**
 * ACE's visual identity in chat. A minimal diamond/spark glyph in ACE's
 * signature hero yellow. Idle = subtle glow. Streaming = pulsing glow +
 * inner rotation. Replaces the placeholder "A" letter avatar.
 *
 * Props:
 *   size      — px dimension (default 28, matches old w-7 h-7)
 *   streaming — true while assistant is mid-response; animates more
 *   className — optional extra classes for wrapper
 */
export default function AceAvatar({ size = 28, streaming = false, className = '' }) {
  const px = size;

  return (
    <motion.div
      className={`relative rounded-xl flex items-center justify-center shrink-0 select-none overflow-hidden ${className}`}
      style={{
        width: px,
        height: px,
        background: 'linear-gradient(135deg, rgba(250,204,21,0.28) 0%, rgba(250,204,21,0.12) 100%)',
        border: '1px solid rgba(250,204,21,0.25)',
        backdropFilter: 'blur(6px)',
      }}
      animate={streaming
        ? { boxShadow: [
            '0 0 8px rgba(250,204,21,0.12)',
            '0 0 16px rgba(250,204,21,0.32)',
            '0 0 8px rgba(250,204,21,0.12)',
          ] }
        : { boxShadow: '0 0 12px rgba(250,204,21,0.10)' }
      }
      transition={streaming
        ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
        : { duration: 0.4 }
      }
      aria-label="Ace"
    >
      {/* Geometric mark — 4-point diamond spark */}
      <motion.svg
        width={px * 0.6}
        height={px * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        animate={streaming ? { rotate: 360 } : { rotate: 0 }}
        transition={streaming
          ? { duration: 6, repeat: Infinity, ease: 'linear' }
          : { duration: 0.4 }
        }
      >
        {/* Central diamond */}
        <path
          d="M12 2 L16 12 L12 22 L8 12 Z"
          fill="rgba(250,204,21,0.95)"
        />
        {/* Cross accent */}
        <path
          d="M2 12 L8 12 M16 12 L22 12"
          stroke="rgba(250,204,21,0.55)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </motion.svg>
    </motion.div>
  );
}
