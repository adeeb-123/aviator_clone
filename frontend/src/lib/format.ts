/** INR + number formatting helpers (Indian locale). */
export const inr = (n: number | undefined | null, dp = 2): string =>
  '₹' + (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export const inrCompact = (n: number | undefined | null): string => {
  const v = n ?? 0;
  const a = Math.abs(v);
  const s = v < 0 ? '-' : '';
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)}Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(2)}L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(1)}k`;
  return `${s}₹${a.toFixed(0)}`;
};

export const num = (n: number | undefined | null): string => (n ?? 0).toLocaleString('en-IN');
export const pct = (n: number | undefined | null): string => `${(n ?? 0).toFixed(2)}%`;
export const dt = (d: string | Date | undefined | null): string =>
  d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const dateShort = (d: string | Date | undefined | null): string =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';
