import { create } from 'zustand';
import { api, setAccessToken, getAccessToken } from './api';
import { reauthSocket } from './socket';
import type { User, GamePhase, PublicBet, RoundHistoryItem, ChatMessage, AdminAlert } from '@/types';

const alertKey = (a: AdminAlert) => a._id ?? a.id ?? '';

interface AuthState {
  user: User | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User | null) => void;
  setBalance: (b: number) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  hydrate: async () => {
    if (!getAccessToken()) {
      set({ loading: false });
      return;
    }
    try {
      const { data } = await api.get('/users/me');
      set({ user: data.user, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    reauthSocket();
    set({ user: data.user });
  },
  register: async (username, email, password, referralCode) => {
    const { data } = await api.post('/auth/register', { username, email, password, referralCode });
    setAccessToken(data.accessToken);
    reauthSocket();
    set({ user: data.user });
  },
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    reauthSocket();
    set({ user: null });
  },
  setUser: (u) => set({ user: u }),
  setBalance: (b) => {
    const u = get().user;
    if (u) set({ user: { ...u, balance: b } });
  },
}));

interface GameState {
  phase: GamePhase;
  roundId: number;
  multiplier: number;
  crashPoint: number | null;
  serverSeedHash: string;
  clientSeed: string;
  bettingEndsAt: number | null;
  players: PublicBet[];
  history: RoundHistoryItem[];
  chat: ChatMessage[];
  set: (partial: Partial<GameState>) => void;
  addChat: (m: ChatMessage) => void;
}

export const useGame = create<GameState>((set) => ({
  phase: 'idle',
  roundId: 0,
  multiplier: 1,
  crashPoint: null,
  serverSeedHash: '',
  clientSeed: '',
  bettingEndsAt: null,
  players: [],
  history: [],
  chat: [],
  set: (partial) => set(partial),
  addChat: (m) => set((s) => ({ chat: [...s.chat.slice(-80), m] })),
}));

interface AlertState {
  alerts: AdminAlert[];
  unread: number;
  latest: AdminAlert | null;
  setAll: (alerts: AdminAlert[], unread: number) => void;
  prepend: (a: AdminAlert) => void;
  markRead: (id: string) => void;
  markAll: () => void;
  clearLatest: () => void;
}

export const useAlerts = create<AlertState>((set) => ({
  alerts: [],
  unread: 0,
  latest: null,
  setAll: (alerts, unread) => set({ alerts, unread }),
  prepend: (a) => set((s) => ({ alerts: [a, ...s.alerts].slice(0, 200), unread: s.unread + (a.read ? 0 : 1), latest: a })),
  markRead: (id) =>
    set((s) => ({
      alerts: s.alerts.map((x) => (alertKey(x) === id ? { ...x, read: true } : x)),
      unread: Math.max(0, s.unread - 1),
    })),
  markAll: () => set((s) => ({ alerts: s.alerts.map((x) => ({ ...x, read: true })), unread: 0 })),
  clearLatest: () => set({ latest: null }),
}));
