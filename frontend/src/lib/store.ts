import { create } from 'zustand';
import { api, setAccessToken, getAccessToken } from './api';
import { reauthSocket } from './socket';
import type { User, GamePhase, PublicBet, RoundHistoryItem, ChatMessage } from '@/types';

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
