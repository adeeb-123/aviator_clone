'use client';

import { motion, useReducedMotion, type Transition } from 'framer-motion';

/**
 * Animated "developer at a desk" scene, drawn as inline SVG so it scales crisply
 * and inherits the product's purple/green palette. Every loop is gentle and
 * disabled entirely under prefers-reduced-motion.
 */
export default function MaintenanceIllustration({ className = '' }: { className?: string }) {
  const reduce = useReducedMotion();
  // Helper: only attach animate/transition props when motion is allowed.
  const loop = (animate: Record<string, unknown>, transition: Transition) =>
    reduce ? {} : { animate, transition };

  const ease = 'easeInOut' as const;

  return (
    <svg
      viewBox="0 0 420 360"
      role="img"
      aria-label="Illustration of a developer working at a desk with a glowing monitor and a cup of coffee"
      className={className}
    >
      <defs>
        <linearGradient id="screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#22d39a" />
        </linearGradient>
        <linearGradient id="deskGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#222236" />
          <stop offset="100%" stopColor="#10101c" />
        </linearGradient>
        <linearGradient id="devBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4c1d95" />
          <stop offset="100%" stopColor="#2e1065" />
        </linearGradient>
        <radialGradient id="ambient" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#a855f7" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* ambient glow behind the scene */}
      <motion.ellipse
        cx="210" cy="150" rx="170" ry="130" fill="url(#ambient)"
        {...loop({ opacity: [0.7, 1, 0.7], scale: [1, 1.04, 1] }, { duration: 6, repeat: Infinity, ease })}
        style={{ transformOrigin: '210px 150px' }}
      />

      {/* floating code symbols */}
      {[
        { x: 62, y: 70, t: '</>', s: 20, c: '#a855f7', d: 0 },
        { x: 330, y: 60, t: '{ }', s: 18, c: '#22d39a', d: 1.2 },
        { x: 360, y: 150, t: ';', s: 22, c: '#f5b50a', d: 0.6 },
        { x: 44, y: 165, t: '( )', s: 16, c: '#7c3aed', d: 1.8 },
        { x: 300, y: 210, t: '=>', s: 15, c: '#a855f7', d: 0.9 },
      ].map((sym) => (
        <motion.text
          key={sym.t + sym.x}
          x={sym.x} y={sym.y} fontSize={sym.s} fontFamily="monospace" fontWeight="700"
          fill={sym.c} opacity={0.5}
          {...loop({ y: [sym.y, sym.y - 9, sym.y], opacity: [0.25, 0.6, 0.25] }, { duration: 6, repeat: Infinity, ease, delay: sym.d })}
        >
          {sym.t}
        </motion.text>
      ))}

      {/* drifting particles */}
      {[110, 160, 250, 300, 200].map((x, i) => (
        <motion.circle
          key={x} cx={x} cy={250} r={2} fill={i % 2 ? '#22d39a' : '#a855f7'}
          {...loop({ cy: [250, 200], opacity: [0, 0.7, 0] }, { duration: 4 + i, repeat: Infinity, ease, delay: i * 0.7 })}
        />
      ))}

      {/* ── monitor ── */}
      <g>
        {/* screen glow */}
        <motion.rect
          x="120" y="70" width="180" height="112" rx="12" fill="url(#screen)" filter="url(#soft)"
          {...loop({ opacity: [0.35, 0.6, 0.35] }, { duration: 3.5, repeat: Infinity, ease })}
        />
        <rect x="122" y="72" width="176" height="108" rx="10" fill="#0d0d18" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" />
        {/* code lines on screen */}
        {[
          { y: 88, w: 70, c: '#a855f7' },
          { y: 100, w: 110, c: '#5b6472' },
          { y: 112, w: 50, c: '#22d39a' },
          { y: 124, w: 95, c: '#5b6472' },
          { y: 136, w: 60, c: '#f5b50a' },
          { y: 148, w: 84, c: '#5b6472' },
        ].map((l, i) => (
          <motion.rect
            key={l.y} x="136" y={l.y} width={l.w} height="5" rx="2.5" fill={l.c}
            {...loop({ opacity: [0.5, 1, 0.5] }, { duration: 2.5, repeat: Infinity, ease, delay: i * 0.25 })}
          />
        ))}
        {/* blinking cursor */}
        <motion.rect
          x="200" y="160" width="7" height="7" rx="1" fill="#22d39a"
          {...loop({ opacity: [1, 1, 0, 0] }, { duration: 1.1, repeat: Infinity, ease: 'linear' })}
        />
        {/* stand + base */}
        <rect x="204" y="182" width="12" height="20" fill="#181826" />
        <rect x="182" y="200" width="56" height="6" rx="3" fill="#222236" />
      </g>

      {/* ── developer ── */}
      <motion.g
        {...loop({ y: [0, -2.5, 0] }, { duration: 4, repeat: Infinity, ease })}
      >
        {/* torso */}
        <path d="M150 300 q60 -46 120 0 Z" fill="url(#devBody)" />
        <rect x="150" y="296" width="120" height="16" fill="url(#devBody)" />
        {/* head */}
        <circle cx="210" cy="250" r="26" fill="#c9a27a" />
        {/* hair */}
        <path d="M184 246 q4 -30 26 -30 q22 0 26 30 q-8 -12 -26 -12 q-18 0 -26 12 Z" fill="#2b2b3a" />
        {/* headphones */}
        <path d="M182 250 a28 28 0 0 1 56 0" fill="none" stroke="#181826" strokeWidth="5" strokeLinecap="round" />
        <rect x="178" y="246" width="9" height="16" rx="4" fill="#7c3aed" />
        <rect x="233" y="246" width="9" height="16" rx="4" fill="#7c3aed" />
        {/* eyes (blink) */}
        <motion.g
          style={{ transformOrigin: '210px 252px' }}
          {...loop({ scaleY: [1, 1, 0.1, 1] }, { duration: 4.5, repeat: Infinity, times: [0, 0.9, 0.95, 1], ease })}
        >
          <circle cx="202" cy="252" r="2.4" fill="#181826" />
          <circle cx="218" cy="252" r="2.4" fill="#181826" />
        </motion.g>
        {/* subtle smile */}
        <path d="M203 262 q7 6 14 0" fill="none" stroke="#8a6a44" strokeWidth="2" strokeLinecap="round" />
      </motion.g>

      {/* ── desk ── */}
      <rect x="70" y="300" width="280" height="40" rx="10" fill="url(#deskGrad)" />
      <rect x="70" y="300" width="280" height="5" rx="2.5" fill="rgba(168,85,247,0.25)" />

      {/* typing hand */}
      <motion.g
        {...loop({ y: [0, -2, 0, -1, 0] }, { duration: 0.7, repeat: Infinity, ease })}
      >
        <rect x="176" y="292" width="68" height="12" rx="6" fill="#181826" />
        <ellipse cx="184" cy="296" rx="7" ry="5" fill="#c9a27a" />
        <ellipse cx="236" cy="296" rx="7" ry="5" fill="#c9a27a" />
      </motion.g>

      {/* ── coffee mug + steam ── */}
      <g>
        {[0, 0.9, 1.8].map((delay, i) => (
          <motion.path
            key={i}
            d={`M${300 + i * 6} 296 q6 -8 0 -16 q-6 -8 0 -16`}
            fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" opacity="0"
            {...loop({ y: [0, -14], opacity: [0, 0.5, 0] }, { duration: 3, repeat: Infinity, ease, delay })}
          />
        ))}
        <rect x="292" y="296" width="26" height="20" rx="4" fill="#7c3aed" />
        <path d="M318 300 h6 a6 6 0 0 1 0 12 h-6" fill="none" stroke="#7c3aed" strokeWidth="3" />
        <ellipse cx="305" cy="297" rx="13" ry="3" fill="#4c1d95" />
      </g>
    </svg>
  );
}
