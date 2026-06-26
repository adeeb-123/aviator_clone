'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { sound } from '@/lib/sound';
import type { SpinSegment } from '@/types';

const R = 96;
const CX = 100;
const CY = 100;

// point on the wheel: angle measured clockwise from the top (pointer at 12 o'clock)
function pt(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(a), y: CY - radius * Math.cos(a) };
}

export default function SpinWheel() {
  const setBalance = useAuth((s) => s.setBalance);
  const [segments, setSegments] = useState<SpinSegment[]>([]);
  const [canSpin, setCanSpin] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => {
    api.get('/users/spin').then((r) => { setSegments(r.data.segments); setCanSpin(r.data.canSpin); }).catch(() => {});
  }, []);

  const n = segments.length;
  const seg = n ? 360 / n : 0;

  const spin = async () => {
    if (spinning || !canSpin || !n) return;
    setSpinning(true); setResult('');
    sound.bet();
    try {
      const { data } = await api.post('/users/spin');
      const i = data.index as number;
      const center = i * seg + seg / 2;
      const final = rotation + 360 * 5 + (360 - (center % 360));
      setRotation(final);
      setTimeout(() => {
        setSpinning(false); setCanSpin(false);
        if (data.prize > 0) { setBalance(data.balance); sound.reward(); setResult(`🎉 You won ${data.segment.label}!`); }
        else setResult('😅 Nothing this time — spin again tomorrow!');
      }, 4200);
    } catch (e: unknown) {
      setSpinning(false);
      setResult((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Spin failed');
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-56 w-56">
        {/* pointer */}
        <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.6))' }}>
          <div className="h-0 w-0 border-x-[10px] border-t-[16px] border-x-transparent border-t-gold" />
        </div>
        <svg viewBox="0 0 200 200" className="h-full w-full" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? 'transform 4s cubic-bezier(0.17,0.67,0.18,0.99)' : 'none' }}>
          {segments.map((s, i) => {
            const a0 = i * seg;
            const a1 = (i + 1) * seg;
            const p0 = pt(a0, R);
            const p1 = pt(a1, R);
            const mid = pt(a0 + seg / 2, R * 0.62);
            const large = seg > 180 ? 1 : 0;
            return (
              <g key={i}>
                <path d={`M ${CX} ${CY} L ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} Z`} fill={s.color} stroke="#0a0a12" strokeWidth="1.5" />
                <text x={mid.x} y={mid.y} fill="#fff" fontSize="11" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${a0 + seg / 2} ${mid.x} ${mid.y})`}>{s.label}</text>
              </g>
            );
          })}
          <circle cx={CX} cy={CY} r="14" fill="#0a0a12" stroke="#eab308" strokeWidth="2" />
        </svg>
      </div>

      <button onClick={spin} disabled={spinning || !canSpin} className="btn-primary mt-4 px-6 disabled:opacity-40">
        {spinning ? 'Spinning…' : canSpin ? '🎡 Spin the wheel' : '✓ Spun today'}
      </button>
      {result && <p className="mt-2 text-sm font-semibold text-gold">{result}</p>}
      {!canSpin && !spinning && !result && <p className="mt-2 text-xs text-white/40">Come back tomorrow for a free spin.</p>}
    </div>
  );
}
