import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';

const RAW_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:5000';
// PaaS service refs may provide a bare host — ensure a scheme is present.
const SOCKET_URL = /^https?:\/\//.test(RAW_SOCKET_URL) ? RAW_SOCKET_URL : `https://${RAW_SOCKET_URL}`;

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: true,
      transports: ['websocket', 'polling'],
      auth: { token: getAccessToken() ?? undefined },
    });
  }
  return socket;
}

/** Re-auth the socket after login/logout. */
export function reauthSocket(): void {
  if (socket) {
    socket.auth = { token: getAccessToken() ?? undefined };
    socket.disconnect().connect();
  }
}

/** Canonical event names (mirror of backend socket/events.ts). */
export const EVENTS = {
  ROUND_BETTING: 'round:betting',
  ROUND_RUNNING: 'round:running',
  ROUND_TICK: 'round:tick',
  ROUND_CRASHED: 'round:crashed',
  ROUND_HISTORY: 'round:history',
  BET_PLACED: 'bet:placed',
  BET_CASHOUT: 'bet:cashout',
  PLAYERS_UPDATE: 'players:update',
  BALANCE_UPDATE: 'balance:update',
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  LEADERBOARD_UPDATE: 'leaderboard:update',
  STATE_INIT: 'state:init',
  PLACE_BET: 'action:placeBet',
  CASHOUT: 'action:cashout',
  SEND_CHAT: 'action:chat',
  TYPING: 'action:typing',
} as const;
