'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const DEFAULT_MSG = 'The Dev is working on this buddy';

/** Settings → Maintenance Mode. Toggle + custom message + live preview + save. */
export default function MaintenanceSettings() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MSG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .get('/admin/config')
      .then((r) => {
        setEnabled(Boolean(r.data.config.maintenanceMode));
        setMessage(r.data.config.maintenanceMessage || DEFAULT_MSG);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const { data } = await api.patch('/admin/config', {
        maintenanceMode: enabled,
        maintenanceMessage: message.trim() || DEFAULT_MSG,
      });
      const on = Boolean(data.config.maintenanceMode);
      setEnabled(on);
      setMessage(data.config.maintenanceMessage || DEFAULT_MSG);
      setToast({
        ok: true,
        text: on
          ? '🛠️ Maintenance mode is ON — players now see the maintenance page.'
          : '✅ Maintenance mode is OFF — the site is live again.',
      });
    } catch {
      setToast({ ok: false, text: 'Could not save maintenance settings.' });
    } finally {
      setSaving(false);
    }
  };

  const previewMsg = message.trim() || DEFAULT_MSG;

  return (
    <div className="glass space-y-5 border border-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest text-white/40">🛠️ Maintenance mode</h3>
          <p className="mt-1 text-xs text-white/40">
            Instantly take the site offline for players. You (admins) keep full access.
          </p>
        </div>
        <Toggle checked={enabled} onChange={setEnabled} />
      </div>

      {enabled && (
        <div className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold">
          ⚠️ When you save, every non-admin player is redirected to the maintenance page.
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-white/50">Custom message</label>
        <textarea
          value={message}
          maxLength={500}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={DEFAULT_MSG}
          className="input resize-none"
        />
        <div className="mt-1 flex justify-between text-[11px] text-white/30">
          <span>Appears as the headline on the maintenance page.</span>
          <span>{message.length}/500</span>
        </div>
      </div>

      {/* Live preview — exactly how the headline renders on the maintenance page */}
      <div>
        <div className="mb-2 text-[11px] uppercase tracking-widest text-white/30">Live preview</div>
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-base-800/70 p-6 text-center">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
          <div className="pointer-events-none absolute -right-10 bottom-0 h-32 w-32 rounded-full bg-win/10 blur-2xl" />
          <span className="relative inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent-glow">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-glow" /> Under maintenance
          </span>
          <div className="relative mt-3 break-words bg-gradient-to-r from-accent-glow via-white to-win bg-clip-text text-xl font-black text-transparent">
            {previewMsg}
          </div>
          <p className="relative mt-2 text-xs text-white/40">
            We&rsquo;re making things even better — thanks for your patience ❤️
          </p>
        </div>
      </div>

      {toast && (
        <div className={`rounded-lg px-3 py-2 text-sm ${toast.ok ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'}`}>
          {toast.text}
        </div>
      )}

      <button onClick={save} disabled={saving || loading} className="btn-primary">
        {saving ? 'Saving…' : 'Save maintenance settings'}
      </button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Enable maintenance mode"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-base-600'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  );
}
