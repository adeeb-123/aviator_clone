'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/lib/store';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

/**
 * 60fps multiplier graph rendered on a Canvas. Reads the live multiplier from
 * the store each frame (the value itself is fed by socket ticks) and draws an
 * accelerating curve, a flying plane, and a particle burst on crash.
 */
export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const particles = useRef<Particle[]>([]);
  const lastPhase = useRef<string>('idle');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const colorFor = (m: number): string => {
      if (m < 2) return '#22d39a';
      if (m < 5) return '#f5b50a';
      return '#ef4444';
    };

    const spawnBurst = (x: number, y: number, color: string) => {
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 6;
        particles.current.push({
          x,
          y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: 1,
          color,
        });
      }
    };

    const draw = () => {
      const { phase, multiplier } = useGame.getState();
      ctx.clearRect(0, 0, width, height);

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < width; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 48) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      const padL = 50;
      const padB = 40;
      const plotW = width - padL - 20;
      const plotH = height - padB - 20;

      // detect crash transition for particle burst
      if (phase === 'crashed' && lastPhase.current !== 'crashed') {
        spawnBurst(padL + plotW * 0.85, 20 + plotH * 0.2, colorFor(multiplier));
      }
      lastPhase.current = phase;

      if (phase === 'running' || phase === 'crashed') {
        const m = Math.max(1, multiplier);
        const color = colorFor(m);

        // Map progress: x by time-ish (use log of multiplier), y by multiplier.
        const progress = Math.min(1, Math.log(m) / Math.log(30));
        const tipX = padL + plotW * Math.min(0.92, 0.1 + progress * 0.85);
        const tipY = height - padB - plotH * Math.min(0.92, progress);

        // curve (quadratic)
        ctx.beginPath();
        ctx.moveTo(padL, height - padB);
        ctx.quadraticCurveTo(padL + (tipX - padL) * 0.5, height - padB, tipX, tipY);
        ctx.lineWidth = 4;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.stroke();

        // fill under curve
        ctx.lineTo(tipX, height - padB);
        ctx.closePath();
        ctx.shadowBlur = 0;
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, color + '00');
        ctx.fillStyle = grad;
        ctx.fill();

        // plane
        if (phase === 'running') {
          ctx.font = '28px serif';
          ctx.fillText('✈️', tipX - 6, tipY + 6);
        } else {
          ctx.font = '30px serif';
          ctx.fillText('💥', tipX - 10, tipY + 6);
        }
      }

      // particles
      ctx.shadowBlur = 0;
      particles.current = particles.current.filter((p) => p.life > 0);
      for (const p of particles.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= 0.02;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}
