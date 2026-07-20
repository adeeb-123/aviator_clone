'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';
import { getSocket } from './socket';

export const DEFAULT_MAINTENANCE_MESSAGE = 'The Dev is working on this buddy';

interface MaintenanceValue {
  loading: boolean;
  maintenanceMode: boolean;
  message: string;
  updatedAt: string | null;
  refresh: () => Promise<void>;
}

const MaintenanceContext = createContext<MaintenanceValue>({
  loading: true,
  maintenanceMode: false,
  message: DEFAULT_MAINTENANCE_MESSAGE,
  updatedAt: null,
  refresh: async () => {},
});

/**
 * Fetches the global maintenance state once, then keeps it live via the
 * `maintenance:update` socket event (admin toggles flip every client instantly).
 * Fails OPEN — if the check errors we never lock users out.
 */
export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState({
    loading: true,
    maintenanceMode: false,
    message: DEFAULT_MAINTENANCE_MESSAGE,
    updatedAt: null as string | null,
  });

  const apply = useCallback((data: { maintenanceMode?: boolean; maintenanceMessage?: string; updatedAt?: string | null }) => {
    setState({
      loading: false,
      maintenanceMode: Boolean(data.maintenanceMode),
      message: data.maintenanceMessage?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
      updatedAt: data.updatedAt ?? null,
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/maintenance');
      apply(data);
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, [apply]);

  useEffect(() => {
    void refresh();
    const socket = getSocket();
    const onUpdate = (data: { maintenanceMode?: boolean; maintenanceMessage?: string; updatedAt?: string }) => apply(data);
    socket.on('maintenance:update', onUpdate);
    return () => { socket.off('maintenance:update', onUpdate); };
  }, [refresh, apply]);

  return (
    <MaintenanceContext.Provider value={{ ...state, refresh }}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export const useMaintenance = (): MaintenanceValue => useContext(MaintenanceContext);
