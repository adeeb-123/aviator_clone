import { useEffect, useRef, useState } from 'react';

/**
 * Runs `load` on mount and then on an interval while `auto` is enabled.
 * Always invokes the latest `load` (captured via ref), so it picks up current
 * filter/search state without restarting the timer. Returns the auto toggle,
 * last-updated timestamp, and a manual refresh fn.
 */
export function useAutoRefresh(load: () => void | Promise<void>, intervalMs = 20000) {
  const [auto, setAuto] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const ref = useRef(load);
  ref.current = load;

  const refresh = async () => {
    await ref.current();
    setUpdatedAt(Date.now());
  };

  useEffect(() => {
    void refresh();
    if (!auto) return;
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, intervalMs]);

  return { auto, setAuto, updatedAt, refresh };
}
