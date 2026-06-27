'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';

interface SBMarket { id: string; threshold: number; payout: number; enabled: boolean }
interface Config {
  minBet: number; maxBet: number; bettingWindowMs: number; roundPauseMs: number;
  blockAdminBetting: boolean; chatProfanityFilter: boolean; bannedWords: string[];
  sideBetsEnabled: boolean; sideBetMin: number; sideBetMax: number; sideBetMarkets: SBMarket[];
  jackpotEnabled: boolean; jackpotRate: number; jackpotSeed: number; jackpotTrigger: number;
}
interface Risk { phase: string; roundBets: number; roundWagered: number; liveExposure: number }

export default function Settings() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [risk, setRisk] = useState<Risk | null>(null);
  const [words, setWords] = useState('');
  const [msg, setMsg] = useState('');
  const [bcast, setBcast] = useState('');
  const [bsev, setBsev] = useState<'info' | 'warning'>('info');
  const [pot, setPotState] = useState(0);
  const [potInput, setPotInput] = useState('');

  useEffect(() => {
    api.get('/admin/config').then((r) => { setCfg(r.data.config); setWords((r.data.config.bannedWords ?? []).join(', ')); }).catch(() => {});
    api.get('/admin/jackpot').then((r) => { setPotState(r.data.pot); setPotInput(String(r.data.pot)); }).catch(() => {});
    const poll = () => api.get('/admin/game/status').then((r) => setRisk(r.data)).catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const set = <K extends keyof Config>(k: K, v: Config[K]) => setCfg((c) => (c ? { ...c, [k]: v } : c));
  const setMarket = (id: string, patch: Partial<SBMarket>) => setCfg((c) => (c ? { ...c, sideBetMarkets: c.sideBetMarkets.map((m) => (m.id === id ? { ...m, ...patch } : m)) } : c));
  const savePot = async () => {
    try { const { data } = await api.post('/admin/jackpot', { pot: Number(potInput) }); setPotState(data.pot); setMsg(`✓ Jackpot set to ${inr(data.pot)}`); }
    catch { setMsg('Could not set jackpot'); }
  };

  const save = async () => {
    if (!cfg) return;
    setMsg('');
    try {
      const body = { ...cfg, bannedWords: words.split(',').map((w) => w.trim()).filter(Boolean) };
      const { data } = await api.patch('/admin/config', body);
      setCfg(data.config); setWords((data.config.bannedWords ?? []).join(', '));
      setMsg('✓ Settings saved — applies from the next round');
    } catch { setMsg('Could not save settings'); }
  };

  const sendBroadcast = async () => {
    if (!bcast.trim()) return;
    try {
      await api.post('/admin/broadcast', { message: bcast, severity: bsev });
      setBcast(''); setMsg('📢 Announcement sent to all players');
    } catch { setMsg('Could not send announcement'); }
  };

  return (
    <div className="space-y-5">
      {/* Live risk */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Engine" value={risk?.phase ?? '—'} />
        <Kpi label="Open bets" value={String(risk?.roundBets ?? 0)} />
        <Kpi label="Round wagered" value={inr(risk?.roundWagered ?? 0)} />
        <Kpi label="Live exposure" value={inr(risk?.liveExposure ?? 0)} tone={(risk?.liveExposure ?? 0) > 5000 ? 'text-loss' : 'text-win'} />
      </div>

      {msg && <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-glow">{msg}</p>}

      {/* Broadcast */}
      <div className="glass p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-widest text-white/40">📢 Broadcast announcement</h3>
        <div className="flex flex-wrap gap-2">
          <input value={bcast} maxLength={280} onChange={(e) => setBcast(e.target.value)} placeholder="Message shown as a banner to every player…" className="input min-w-0 flex-1" />
          <select value={bsev} onChange={(e) => setBsev(e.target.value as 'info' | 'warning')} className="input max-w-[120px]">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
          </select>
          <button onClick={sendBroadcast} className="btn-primary">Send</button>
        </div>
      </div>

      {/* Game config */}
      {cfg && (
        <div className="glass space-y-4 p-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">⚙️ Game settings (live)</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Min bet (₹)"><input type="number" value={cfg.minBet} onChange={(e) => set('minBet', Number(e.target.value))} className="input" /></Field>
            <Field label="Max bet (₹)"><input type="number" value={cfg.maxBet} onChange={(e) => set('maxBet', Number(e.target.value))} className="input" /></Field>
            <Field label="Betting window (sec)"><input type="number" value={cfg.bettingWindowMs / 1000} onChange={(e) => set('bettingWindowMs', Number(e.target.value) * 1000)} className="input" /></Field>
            <Field label="Pause between rounds (sec)"><input type="number" value={cfg.roundPauseMs / 1000} onChange={(e) => set('roundPauseMs', Number(e.target.value) * 1000)} className="input" /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.blockAdminBetting} onChange={(e) => set('blockAdminBetting', e.target.checked)} /> Block admins from placing bets</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.chatProfanityFilter} onChange={(e) => set('chatProfanityFilter', e.target.checked)} /> Chat profanity filter</label>
          <Field label="Banned words (comma-separated)"><input value={words} onChange={(e) => setWords(e.target.value)} className="input" /></Field>
          <button onClick={save} className="btn-primary">Save settings</button>
          <p className="text-[11px] text-white/30">Changes apply from the next round — the current round is never disrupted. House edge stays env-locked to preserve provably-fair.</p>
        </div>
      )}

      {/* Progressive jackpot */}
      {cfg && (
        <div className="glass space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">🎰 Progressive jackpot</h3>
            <span className="text-sm text-white/50">Live pot: <b className="text-gold">{inr(pot)}</b></span>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.jackpotEnabled} onChange={(e) => set('jackpotEnabled', e.target.checked)} /> Jackpot enabled</label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Contribution rate (% of each wager)"><input type="number" step="0.1" value={cfg.jackpotRate * 100} onChange={(e) => set('jackpotRate', Number(e.target.value) / 100)} className="input" /></Field>
            <Field label="Seed (reset pot after a win)"><input type="number" value={cfg.jackpotSeed} onChange={(e) => set('jackpotSeed', Number(e.target.value))} className="input" /></Field>
            <Field label="Trigger (cash out ≥ this x to win)"><input type="number" value={cfg.jackpotTrigger} onChange={(e) => set('jackpotTrigger', Number(e.target.value))} className="input" /></Field>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Set pot to ₹"><input type="number" value={potInput} onChange={(e) => setPotInput(e.target.value)} className="input max-w-[160px]" /></Field>
            <button onClick={savePot} className="btn bg-base-600 text-white">Set pot</button>
            <button onClick={save} className="btn-primary">Save jackpot config</button>
          </div>
        </div>
      )}

      {/* Side bets */}
      {cfg && (
        <div className="glass space-y-3 p-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">🎯 Side bets (prop bets on the crash)</h3>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cfg.sideBetsEnabled} onChange={(e) => set('sideBetsEnabled', e.target.checked)} /> Side bets enabled</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Min side bet (₹)"><input type="number" value={cfg.sideBetMin} onChange={(e) => set('sideBetMin', Number(e.target.value))} className="input" /></Field>
            <Field label="Max side bet (₹)"><input type="number" value={cfg.sideBetMax} onChange={(e) => set('sideBetMax', Number(e.target.value))} className="input" /></Field>
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
              <span>Market (crash ≥)</span><span>Payout ×</span><span>On</span><span></span>
            </div>
            {cfg.sideBetMarkets.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
                <span className="text-sm font-bold">≥ {m.threshold}x</span>
                <input type="number" step="0.01" value={m.payout} onChange={(e) => setMarket(m.id, { payout: Number(e.target.value) })} className="input max-w-[90px] py-1 text-right" />
                <input type="checkbox" checked={m.enabled} onChange={(e) => setMarket(m.id, { enabled: e.target.checked })} />
                <span className="text-[11px] text-white/30">{m.payout < m.threshold ? `edge ${Math.round((1 - m.payout / m.threshold) * 100)}%` : 'no edge!'}</span>
              </div>
            ))}
          </div>
          <button onClick={save} className="btn-primary">Save side bets</button>
          <p className="text-[11px] text-white/30">Payout × is what a winning stake multiplies by. Keep it below the threshold to retain a house edge.</p>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass min-w-0 overflow-hidden p-3">
      <div className="truncate text-[11px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-black capitalize ${tone ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-white/50">{label}</span>
      {children}
    </label>
  );
}
