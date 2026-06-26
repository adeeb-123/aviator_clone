/* Tiny Web-Audio sound engine — synthesised tones, no asset files. */
type Ctx = AudioContext;
let ctx: Ctx | null = null;
let muted = typeof window !== 'undefined' && localStorage.getItem('aviatorMuted') === '1';
const listeners = new Set<(m: boolean) => void>();

function ac(): Ctx | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; to?: number } = {}): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
  const peak = opts.gain ?? 0.05;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const sound = {
  isMuted: () => muted,
  subscribe(fn: (m: boolean) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  toggle() {
    muted = !muted;
    if (typeof window !== 'undefined') localStorage.setItem('aviatorMuted', muted ? '1' : '0');
    listeners.forEach((l) => l(muted));
    if (!muted) tone(440, 0.06); // confirmation blip
    return muted;
  },
  bet() { if (!muted) tone(200, 0.09, { type: 'square', gain: 0.035 }); },
  win() { if (!muted) { tone(660, 0.1, { gain: 0.05 }); tone(990, 0.14, { gain: 0.05, delay: 0.09 }); } },
  cashout() { if (!muted) { tone(520, 0.08, { gain: 0.045 }); tone(780, 0.1, { gain: 0.045, delay: 0.07 }); } },
  crash() { if (!muted) tone(300, 0.35, { type: 'sawtooth', gain: 0.06, to: 70 }); },
  reward() { if (!muted) { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { gain: 0.045, delay: i * 0.08 })); } },
};
