import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis, isRedisAvailable } from '../config/redis';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User';
import { Chat } from '../models/Chat';
import { getGameEngine } from '../services/gameEngine';
import { cfg, filterProfanity } from '../services/runtimeConfig';
import { EVENTS } from './events';
import { logger } from '../utils/logger';

interface SocketUser {
  id: string;
  username: string;
  role: 'user' | 'admin';
}

declare module 'socket.io' {
  interface Socket {
    authUser?: SocketUser;
  }
}

const EMOJI_OK = /^[\s\S]{1,280}$/;

// Per-socket rate limits (fixed window) to stop floods / abuse of realtime actions.
const RATE: Record<string, { max: number; windowMs: number }> = {
  'action:placeBet': { max: 12, windowMs: 5000 },
  'action:cashout': { max: 20, windowMs: 5000 },
  'action:chat': { max: 5, windowMs: 10000 },
  'action:typing': { max: 15, windowMs: 10000 },
};
function rateLimited(socket: Socket, action: string): boolean {
  const cfg = RATE[action];
  if (!cfg) return false;
  const now = Date.now();
  const store = (socket.data.rl ??= {}) as Record<string, { count: number; reset: number }>;
  const b = store[action] ?? { count: 0, reset: now + cfg.windowMs };
  if (now > b.reset) { b.count = 0; b.reset = now + cfg.windowMs; }
  b.count += 1;
  store[action] = b;
  return b.count > cfg.max;
}

export async function setupSocket(io: Server): Promise<void> {
  // Redis adapter for horizontal scaling (skipped if Redis is unavailable —
  // single-instance dev mode still works without it).
  if (redis && isRedisAvailable()) {
    const pubClient = redis;
    const subClient = redis.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.io using Redis adapter');
  } else {
    logger.warn('Socket.io running without Redis adapter (single instance only)');
  }

  // Optional auth handshake — guests may watch, only authed users may bet/chat.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        socket.authUser = { id: payload.sub, username: payload.username, role: payload.role };
      } catch {
        /* anonymous spectator */
      }
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const engine = getGameEngine();

    // send current state to the freshly-connected client
    socket.emit('state:init', engine.getSnapshot());

    if (socket.authUser) {
      socket.join(`user:${socket.authUser.id}`);
      if (socket.authUser.role === 'admin') socket.join('admins'); // receives admin:alert events
    }

    socket.on(EVENTS.PLACE_BET, async (data, ack) => {
      try {
        if (!socket.authUser) throw new Error('Login required');
        if (socket.authUser.role === 'admin' && cfg().blockAdminBetting) throw new Error('Admins cannot place bets');
        if (rateLimited(socket, EVENTS.PLACE_BET)) throw new Error('Too many requests — slow down');
        const result = await engine.placeBet({
          userId: socket.authUser.id,
          username: socket.authUser.username,
          slot: data.slot === 2 ? 2 : 1,
          amount: Number(data.amount),
          autoCashout: data.autoCashout ? Number(data.autoCashout) : undefined,
        });
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on(EVENTS.CASHOUT, async (data, ack) => {
      try {
        if (!socket.authUser) throw new Error('Login required');
        if (rateLimited(socket, EVENTS.CASHOUT)) throw new Error('Too many requests — slow down');
        const result = await engine.cashout(socket.authUser.id, data.slot === 2 ? 2 : 1, data.fraction ? Number(data.fraction) : 1);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on(EVENTS.SEND_CHAT, async (data, ack) => {
      try {
        if (!socket.authUser) throw new Error('Login required');
        if (rateLimited(socket, EVENTS.SEND_CHAT)) throw new Error('You are sending messages too fast');
        const raw = String(data.message ?? '').trim();
        if (!raw || !EMOJI_OK.test(raw)) throw new Error('Invalid message');

        const user = await User.findById(socket.authUser.id).select('avatar isBanned isSuspended chatMutedUntil').lean();
        if (user?.isBanned || user?.isSuspended) throw new Error('You are not allowed to chat');
        if (user?.chatMutedUntil && new Date(user.chatMutedUntil) > new Date()) throw new Error('You are muted by a moderator');

        const message = filterProfanity(raw);
        const chat = await Chat.create({
          userId: socket.authUser.id,
          username: socket.authUser.username,
          avatar: user?.avatar,
          message,
          room: 'global',
        });
        io.emit(EVENTS.CHAT_MESSAGE, {
          id: String(chat._id),
          username: chat.username,
          avatar: chat.avatar,
          message: chat.message,
          createdAt: chat.createdAt,
        });
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on(EVENTS.TYPING, () => {
      if (socket.authUser && !rateLimited(socket, EVENTS.TYPING)) {
        socket.broadcast.emit(EVENTS.CHAT_TYPING, { username: socket.authUser.username });
      }
    });

    socket.on('disconnect', () => {
      /* presence cleanup handled by socket.io rooms */
    });
  });

  logger.info('Socket.io initialised');
}
