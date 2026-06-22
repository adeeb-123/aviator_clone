import {
  computeCrashPoint,
  verifyRound,
  sha256,
  generateServerSeed,
  generateClientSeed,
} from '../utils/provablyFair';

describe('provably fair', () => {
  const serverSeed = 'a'.repeat(64);
  const clientSeed = 'client123';

  it('is deterministic for the same inputs', () => {
    const a = computeCrashPoint(serverSeed, clientSeed, 1, 0.03);
    const b = computeCrashPoint(serverSeed, clientSeed, 1, 0.03);
    expect(a).toBe(b);
  });

  it('always returns a multiplier >= 1.00', () => {
    for (let nonce = 0; nonce < 500; nonce++) {
      const cp = computeCrashPoint(serverSeed, clientSeed, nonce, 0.03);
      expect(cp).toBeGreaterThanOrEqual(1);
    }
  });

  it('produces different outcomes for different nonces', () => {
    const set = new Set<number>();
    for (let nonce = 0; nonce < 50; nonce++) {
      set.add(computeCrashPoint(serverSeed, clientSeed, nonce));
    }
    expect(set.size).toBeGreaterThan(10);
  });

  it('roughly respects the house edge (instant busts)', () => {
    let busts = 0;
    const N = 20000;
    for (let nonce = 0; nonce < N; nonce++) {
      if (computeCrashPoint(serverSeed, clientSeed, nonce, 0.1) === 1) busts++;
    }
    const rate = busts / N;
    expect(rate).toBeGreaterThan(0.07);
    expect(rate).toBeLessThan(0.13);
  });

  it('verifyRound reproduces the committed hash', () => {
    const result = verifyRound({ serverSeed, clientSeed, nonce: 7 });
    expect(result.serverSeedHash).toBe(sha256(serverSeed));
    expect(result.crashPoint).toBe(computeCrashPoint(serverSeed, clientSeed, 7));
  });

  it('generates seeds of expected shape', () => {
    expect(generateServerSeed()).toHaveLength(64);
    expect(generateClientSeed()).toHaveLength(16);
  });
});
