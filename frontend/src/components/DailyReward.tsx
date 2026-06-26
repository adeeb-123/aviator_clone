'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { sound } from '@/lib/sound';

const sameDay = (iso?: string) => {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
};

export default function DailyReward() {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const hydrate = useAuth((s) => s.hydrate);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const claimed = sameDay(user.lastDailyClaim);
  const claim = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/users/daily-claim');
      if (data.claimed) {
        setBalance(data.balance);
        sound.reward();
        setMsg(`🎁 +₹${data.reward} · Day ${data.streak} streak!`);
        await hydrate();
      } else {
        setMsg('Already claimed — come back tomorrow!');
      }
    } catch {
      setMsg('Could not claim right now.');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        disabled={busy || claimed}
        onClick={claim}
        className={`btn text-sm ${claimed ? 'bg-base-700 text-white/40' : 'btn-win animate-pulseGlow'}`}
      >
        {claimed ? `✓ Claimed · 🔥 ${user.dailyStreak ?? 0}d` : '🎁 Claim daily reward'}
      </button>
      {msg && <span className="text-xs text-gold">{msg}</span>}
    </div>
  );
}
