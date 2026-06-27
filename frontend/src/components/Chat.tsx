'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { getSocket, EVENTS } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';

const EMOJIS = ['🚀', '✈️', '🔥', '💰', '😎', '😱', '🎉', '💎', '🤑', '😭'];
const REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '💰'];

export default function Chat() {
  const { t } = useT();
  const user = useAuth((s) => s.user);
  const setBalance = useAuth((s) => s.setBalance);
  const messages = useGame((s) => s.chat);
  const [text, setText] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    const onTyping = (p: { username: string }) => { setTypingUser(p.username); setTimeout(() => setTypingUser(null), 1500); };
    socket.on(EVENTS.CHAT_TYPING, onTyping);
    return () => { socket.off(EVENTS.CHAT_TYPING, onTyping); };
  }, []);

  const send = () => {
    if (!text.trim() || !user) return;
    getSocket().emit(EVENTS.SEND_CHAT, { message: text.trim() });
    setText('');
  };
  const react = (messageId: string, emoji: string) => { getSocket().emit('action:react', { messageId, emoji }); setPickerFor(null); };

  const rain = async () => {
    const amount = Number(window.prompt('Rain how much ₹ on recent chatters?', '100'));
    if (!amount || amount < 10) return;
    try {
      const { data } = await api.post('/users/rain', { amount });
      setBalance(data.balance);
    } catch (e: unknown) { alert((e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Rain failed'); }
  };

  return (
    <div className="glass flex h-full flex-col p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{t('chat.title')}</h3>
        {user && <button onClick={rain} title="Drop credits on recent chatters" className="rounded-lg bg-base-700 px-2 py-1 text-xs text-white/70 hover:text-white">🌧️ Rain</button>}
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-white/30">{t('chat.sayHi')}</p>}
        {messages.map((m) => {
          const system = m.id.startsWith('rain-');
          const reactions = m.reactions ? Object.entries(m.reactions).filter(([, n]) => n > 0) : [];
          return (
            <div key={m.id} className="group relative text-sm">
              <div className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  {system ? (
                    <span className="font-semibold text-gold">{m.username}</span>
                  ) : (
                    <Link href={`/u/${m.username}`} className="font-semibold text-accent-glow hover:underline">{m.avatar ? `${m.avatar} ` : ''}{m.username}</Link>
                  )}{' '}
                  <span className="break-words text-white/80">{m.message}</span>
                </div>
                {!system && user && (
                  <button onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)} className="shrink-0 px-1 text-xs text-white/20 opacity-0 transition hover:text-white group-hover:opacity-100">😊</button>
                )}
                {user?.role === 'admin' && !system && (
                  <button onClick={() => api.delete(`/admin/chat/${m.id}`).catch(() => {})} title="Delete" className="shrink-0 px-1 text-xs text-white/20 opacity-0 transition hover:text-loss group-hover:opacity-100">🗑️</button>
                )}
              </div>

              {/* reaction picker */}
              {pickerFor === m.id && (
                <div className="mt-1 flex gap-1 rounded-lg bg-base-700 p-1">
                  {REACTIONS.map((e) => <button key={e} onClick={() => react(m.id, e)} className="rounded px-1 text-base hover:bg-base-600">{e}</button>)}
                </div>
              )}

              {/* reaction counts */}
              {reactions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {reactions.map(([emoji, n]) => (
                    <button key={emoji} onClick={() => react(m.id, emoji)} className="rounded-full bg-base-700/60 px-1.5 py-0.5 text-[11px] hover:bg-base-600">{emoji} {n}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="h-5 text-xs text-white/40">{typingUser ? `${typingUser} is typing…` : ''}</div>

      <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
        {EMOJIS.map((e) => (
          <button key={e} className="rounded px-1 text-lg hover:bg-base-600" onClick={() => setText((t) => t + e)}>{e}</button>
        ))}
      </div>

      <div className="mt-1 flex gap-2">
        <input
          className="input"
          placeholder={user ? t('chat.message') : t('chat.loginToChat')}
          disabled={!user}
          value={text}
          maxLength={280}
          onChange={(e) => { setText(e.target.value); getSocket().emit(EVENTS.TYPING); }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn-primary" onClick={send} disabled={!user}>{t('chat.send')}</button>
      </div>
    </div>
  );
}
