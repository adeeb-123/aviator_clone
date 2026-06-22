/** Canonical socket event names shared by server and client. */
export const EVENTS = {
  // server -> client
  ROUND_BETTING: 'round:betting', // betting window opened
  ROUND_RUNNING: 'round:running', // multiplier started
  ROUND_TICK: 'round:tick', // multiplier update (~100ms)
  ROUND_CRASHED: 'round:crashed', // round ended
  ROUND_HISTORY: 'round:history',
  BET_PLACED: 'bet:placed', // someone placed a bet
  BET_CASHOUT: 'bet:cashout', // someone cashed out
  PLAYERS_UPDATE: 'players:update', // active bettors snapshot
  BALANCE_UPDATE: 'balance:update', // private to a user
  CHAT_MESSAGE: 'chat:message',
  CHAT_TYPING: 'chat:typing',
  LEADERBOARD_UPDATE: 'leaderboard:update',
  ERROR: 'error:message',

  // client -> server
  PLACE_BET: 'action:placeBet',
  CASHOUT: 'action:cashout',
  SEND_CHAT: 'action:chat',
  TYPING: 'action:typing',
  SET_CLIENT_SEED: 'action:setClientSeed',
} as const;

export interface RoundBettingPayload {
  roundId: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  bettingEndsAt: number; // epoch ms
}

export interface RoundTickPayload {
  roundId: number;
  multiplier: number;
  elapsed: number;
}

export interface RoundCrashedPayload {
  roundId: number;
  crashPoint: number;
  serverSeedHash: string;
}

export interface PublicBet {
  username: string;
  amount: number;
  slot: 1 | 2;
  autoCashout?: number;
  cashoutMultiplier?: number;
  payout?: number;
  status: 'pending' | 'cashed-out' | 'lost';
}
