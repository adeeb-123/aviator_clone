'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket, EVENTS } from '@/lib/socket';
import { useAuth, useGame } from '@/lib/store';
import { api } from '@/lib/api';

const EMOJIS = ['🚀', '✈️', '🔥', '💰', '😎', '😱', '🎉', '💎', '🤑', '😭'];

export default function Chat() {
  const user = useAuth((s) => s.user);
  const messages = useGame((s) => s.chat);
  const [text, setText] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    const onTyping = (p: { username: string }) => {
      setTypingUser(p.username);
      setTimeout(() => setTypingUser(null), 1500);
    };
    socket.on(EVENTS.CHAT_TYPING, onTyping);
    return () => {
      socket.off(EVENTS.CHAT_TYPING, onTyping);
    };
  }, []);

  const send = () => {
    if (!text.trim() || !user) return;
    getSocket().emit(EVENTS.SEND_CHAT, { message: text.trim() });
    setText('');
  };

  return (
    <div className="glass flex h-full flex-col p-4">
      <h3 className="mb-2 font-semibold">Live Chat</h3>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 && <p className="text-sm text-white/30">Say hi to the table 👋</p>}
        {messages.map((m) => (
          <div key={m.id} className="group flex items-start gap-1 text-sm">
            <div className="min-w-0 flex-1">
              <span className="font-semibold text-accent-glow">{m.username}</span>{' '}
              <span className="break-words text-white/80">{m.message}</span>
            </div>
            {user?.role === 'admin' && (
              <button
                onClick={() => api.delete(`/admin/chat/${m.id}`).catch(() => {})}
                title="Delete message"
                className="shrink-0 px-1 text-xs text-white/20 opacity-0 transition hover:text-loss group-hover:opacity-100"
              >🗑️</button>
            )}
          </div>
        ))}
      </div>

      <div className="h-5 text-xs text-white/40">{typingUser ? `${typingUser} is typing…` : ''}</div>

      <div className="mt-1 flex gap-1 overflow-x-auto pb-1">
        {EMOJIS.map((e) => (
          <button key={e} className="rounded px-1 text-lg hover:bg-base-600" onClick={() => setText((t) => t + e)}>
            {e}
          </button>
        ))}
      </div>

      <div className="mt-1 flex gap-2">
        <input
          className="input"
          placeholder={user ? 'Message…' : 'Log in to chat'}
          disabled={!user}
          value={text}
          maxLength={280}
          onChange={(e) => {
            setText(e.target.value);
            getSocket().emit(EVENTS.TYPING);
          }}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button className="btn-primary" onClick={send} disabled={!user}>
          Send
        </button>
      </div>
    </div>
  );
}
