import { useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';

// ─── TiltCard ─────────────────────────────────────────────────────────────────
// 3D tilt-on-hover using Framer Motion useMotionValue + useTransform.
// Drop-in wrapper around any element — no new dependencies needed.
// intensity: max rotation degrees (default 7). glare: subtle light reflection overlay.

export default function TiltCard({ children, className = '', intensity = 7, glare = true, style = {}, ...props }) {
  const ref = useRef(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-0.5, 0.5], [intensity, -intensity]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-intensity, intensity]);

  // Glare position: follows cursor within the card (always called — React hooks rule)
  const glareX = useTransform(x, [-0.5, 0.5], [0, 100]);
  const glareY = useTransform(y, [-0.5, 0.5], [0, 100]);
  const glareBackground = useTransform(
    [glareX, glareY],
    ([gx, gy]) => `radial-gradient(circle at ${gx}% ${gy}%, rgba(255,255,255,0.04) 0%, transparent 60%)`
  );

  const springConfig = { stiffness: 300, damping: 28 };
  const springRotateX = useSpring(rotateX, springConfig);
  const springRotateY = useSpring(rotateY, springConfig);

  function onMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      style={{
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformStyle: 'preserve-3d',
        perspective: 900,
        ...style,
      }}
      className={`relative ${className}`}
      {...props}
    >
      {children}
      {/* Subtle glare overlay — moves with cursor */}
      {glare && (
        <motion.div
          className="absolute inset-0 rounded-[inherit] pointer-events-none"
          style={{ background: glareBackground }}
        />
      )}
    </motion.div>
  );
}
