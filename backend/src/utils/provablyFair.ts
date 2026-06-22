import crypto from 'crypto';
import { env } from '../config/env';

/**
 * Provably-fair crash point generation.
 *
 * The crash multiplier for a round is derived deterministically from:
 *   HMAC_SHA256(key = serverSeed, message = `${clientSeed}:${nonce}`)
 *
 * Because the server commits to the hash of `serverSeed` BEFORE the round
 * (players see SHA256(serverSeed)), and the player supplies/knows clientSeed,
 * neither party can manipulate the outcome. After the seed rotates, the raw
 * serverSeed is revealed so anyone can recompute and verify every round.
 *
 * The house edge is applied by giving an `houseEdge` probability of an instant
 * 1.00x bust, and otherwise mapping a uniform float in [0,1) to the standard
 * crash distribution  f = 1 / (1 - u).
 */

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function hmacSha256(key: string, message: string): string {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateClientSeed(): string {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Convert the first 52 bits of the hash into a uniform float in [0, 1).
 * 52 bits = the mantissa precision of an IEEE-754 double.
 */
function hashToUniform(hash: string): number {
  const slice = hash.slice(0, 13); // 13 hex chars = 52 bits
  const int = parseInt(slice, 16);
  return int / Math.pow(2, 52);
}

/**
 * Compute the crash point for a round. Returns a multiplier >= 1.00.
 */
export function computeCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  houseEdge: number = env.game.houseEdge,
): number {
  const hash = hmacSha256(serverSeed, `${clientSeed}:${nonce}`);

  // Instant-bust band implements the house edge fairly.
  const bustHash = parseInt(hash.slice(0, 8), 16);
  const bustThreshold = houseEdge * 0xffffffff;
  if (bustHash < bustThreshold) {
    return 1.0;
  }

  const u = hashToUniform(hash);
  // Standard crash curve. Clamp u away from 1 to avoid Infinity.
  const safeU = Math.min(u, 0.999999999);
  const raw = 1 / (1 - safeU);

  // Floor to 2 decimals, cap to a sane maximum.
  const crash = Math.floor(raw * 100) / 100;
  return Math.min(Math.max(crash, 1.0), 1_000_000);
}

/**
 * Re-run a round's computation for the public verification page.
 */
export function verifyRound(params: {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  houseEdge?: number;
}): { crashPoint: number; serverSeedHash: string; hmac: string } {
  const { serverSeed, clientSeed, nonce, houseEdge } = params;
  return {
    crashPoint: computeCrashPoint(serverSeed, clientSeed, nonce, houseEdge),
    serverSeedHash: sha256(serverSeed),
    hmac: hmacSha256(serverSeed, `${clientSeed}:${nonce}`),
  };
}
