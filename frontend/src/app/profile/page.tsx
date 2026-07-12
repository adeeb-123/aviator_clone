'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import TwoFactorSettings from '@/components/TwoFactorSettings';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

const AVATARS = ['✈️', '🚀', '🎲', '🍀', '🔥', '💎', '🐋', '👑', '🦈', '🎯', '⚡', '🌟', '🤑', '🦅', '🎰', '🏆'];

export default function ProfilePage() {
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [avatar, setAvatar] = useState(user?.avatar ?? '✈️');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen">
        <Header />
        <p className="p-10 text-center text-white/50">Please log in to edit your profile.</p>
      </div>
    );
  }

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      const { data } = await api.patch('/users/me', { avatar, bio });
      setUser(data.user);
      setMsg('✓ Profile saved');
    } catch (e: unknown) {
      setMsg((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-xl space-y-5 px-3 py-8 sm:px-4">
        <h1 className="text-2xl font-black sm:text-3xl">Profile</h1>

        <div className="glass space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-base-700 text-3xl">{avatar}</div>
            <div>
              <div className="text-lg font-bold">@{user.username}</div>
              <div className="text-xs text-white/40">{user.email}</div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Choose an avatar</label>
            <div className="grid grid-cols-8 gap-2">
              {AVATARS.map((a) => (
                <button key={a} onClick={() => setAvatar(a)} className={`flex h-10 items-center justify-center rounded-lg text-xl transition ${avatar === a ? 'bg-accent ring-2 ring-accent-glow' : 'bg-base-700 hover:bg-base-600'}`}>{a}</button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-white/40">Bio</label>
            <textarea value={bio} maxLength={280} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Say something about yourself…" className="input w-full resize-none" />
            <div className="mt-1 text-right text-[11px] text-white/30">{bio.length}/280</div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save profile'}</button>
            {msg && <span className="text-sm text-win">{msg}</span>}
          </div>
        </div>

        <TwoFactorSettings />
      </main>
    </div>
  );
}
