'use client';

import { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import DailyReward from '@/components/DailyReward';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { sound } from '@/lib/sound';
import { inr, inrCompact } from '@/lib/format';
import type { VipInfo, ReferralInfo, Quest } from '@/types';

export default function RewardsPage() {
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const [vip, setVip] = useState<VipInfo | null>(null);
  const [refs, setRefs] = useState<ReferralInfo | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [msg, setMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(() => {
    api.get('/users/vip').then((r) => setVip(r.data)).catch(() => {});
    api.get('/users/referrals').then((r) => setRefs(r.data)).catch(() => {});
    api.get('/users/quests').then((r) => setQuests(r.data.quests)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-10 text-center text-white/50">Please log in to view your rewards.</p>
      </div>
    );
  }

  const claimQuest = async (id: string) => {
    try {
      const { data } = await api.post(`/users/quests/${id}/claim`);
      setBalance(data.balance); sound.reward();
      setMsg(`🎁 Quest reward +${inr(data.reward)}!`);
      load();
    } catch (e: unknown) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not claim'); }
  };

  const claimCashback = async () => {
    try {
      const { data } = await api.post('/users/cashback');
      if (data.claimed) { setBalance(data.balance); sound.reward(); setMsg(`💸 Cashback +${inr(data.cashback)}!`); }
      else setMsg(data.reason ?? 'No cashback available');
      load();
    } catch (e: unknown) { setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not claim cashback'); }
  };

  const refLink = typeof window !== 'undefined' && refs ? `${window.location.origin}/?ref=${refs.code}` : '';
  const copyLink = () => { navigator.clipboard?.writeText(refLink); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-4xl space-y-6 px-3 py-8 sm:px-4">
        <div>
          <h1 className="text-2xl font-black sm:text-3xl">🎁 Rewards</h1>
          <p className="text-sm text-white/40">Daily bonuses, loyalty perks, missions and referrals.</p>
        </div>
        {msg && <p className="rounded-lg bg-accent/15 px-3 py-2 text-sm text-accent-glow">{msg}</p>}

        {/* Daily reward */}
        <section className="glass p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Daily login bonus</h2>
          <DailyReward />
        </section>

        {/* VIP */}
        {vip && (
          <section className="glass p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{vip.tier.icon}</span>
                <div>
                  <div className="text-xl font-black">{vip.tier.name} <span className="text-sm font-normal text-white/40">· Tier {vip.tier.tier}</span></div>
                  <div className="text-xs text-white/50">{vip.tier.perk}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-white/40">Lifetime wagered</div>
                <div className="text-lg font-black tabular-nums text-accent-glow">{inrCompact(vip.wagered)}</div>
              </div>
            </div>

            {vip.next ? (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-white/50">
                  <span>Progress to {vip.next.icon} {vip.next.name}</span>
                  <span>{inrCompact(vip.toNext)} to go</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-base-700">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-glow transition-all" style={{ width: `${vip.progressPct}%` }} />
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold text-gold">🏆 You&apos;ve reached the top tier!</p>
            )}

            {vip.tier.cashback > 0 && (
              <button onClick={claimCashback} className="btn-win mt-4 text-sm">
                💸 Claim weekly cashback ({(vip.tier.cashback * 100).toFixed(0)}% of net losses)
              </button>
            )}

            {/* ladder */}
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {vip.tiers.map((t) => (
                <div key={t.tier} className={`rounded-lg border p-2 text-center text-xs ${t.tier === vip.tier.tier ? 'border-accent-glow bg-accent/10' : 'border-white/10 opacity-70'}`}>
                  <div className="text-2xl">{t.icon}</div>
                  <div className="font-bold">{t.name}</div>
                  <div className="text-white/40">{inrCompact(t.min)}+</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Quests */}
        <section className="glass p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Daily missions</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {quests.map((q) => {
              const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
              return (
                <div key={q.id} className="rounded-xl border border-white/10 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-semibold"><span className="text-lg">{q.icon}</span> {q.label}</div>
                    <span className="text-xs font-bold text-gold">+{inr(q.reward, 0)}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-base-700">
                    <div className={`h-full rounded-full ${q.completed ? 'bg-win' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs tabular-nums text-white/50">{q.progress} / {q.target}</span>
                    {q.claimed ? (
                      <span className="text-xs font-bold text-win">✓ Claimed</span>
                    ) : q.completed ? (
                      <button onClick={() => claimQuest(q.id)} className="btn-primary px-3 py-1 text-xs">Claim</button>
                    ) : (
                      <span className="text-xs text-white/30">In progress</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] text-white/30">Missions reset daily at midnight.</p>
        </section>

        {/* Referral */}
        {refs && (
          <section className="glass p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-white/40">Invite friends · earn {inr(refs.bonusPerReferral, 0)} each</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input readOnly value={refLink} className="input min-w-0 flex-1 font-mono text-xs" />
              <button onClick={copyLink} className="btn-primary text-sm">{copied ? '✓ Copied' : 'Copy link'}</button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-base-700/40 p-3 text-center">
                <div className="text-2xl font-black text-accent-glow">{refs.count}</div>
                <div className="text-xs text-white/50">Friends invited</div>
              </div>
              <div className="rounded-lg bg-base-700/40 p-3 text-center">
                <div className="text-2xl font-black text-win">{inr(refs.earned, 0)}</div>
                <div className="text-xs text-white/50">Total earned</div>
              </div>
            </div>
            {refs.referrals.length > 0 && (
              <div className="mt-4 space-y-1">
                {refs.referrals.map((r) => (
                  <div key={r._id} className="flex items-center justify-between rounded-lg bg-base-700/20 px-3 py-1.5 text-sm">
                    <span className="font-semibold">@{r.username}</span>
                    <span className="text-xs text-white/40">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
