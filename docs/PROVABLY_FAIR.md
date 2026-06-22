# Provably Fair System

## Goal
Let any player verify that the house could not manipulate a round's outcome.

## Commit–reveal scheme
1. The server generates a random 256-bit **server seed** and publishes its
   commitment `SHA256(serverSeed)` (visible before every round as `serverSeedHash`).
2. Each round also has a **client seed** (random per round; players may also supply
   their own in extended setups) and an incrementing **nonce**.
3. The crash point is derived deterministically:

   ```
   hmac  = HMAC_SHA256(key = serverSeed, msg = `${clientSeed}:${nonce}`)
   ```

4. **House edge** — the first 32 bits of the HMAC define an "instant bust" band:
   ```
   if int(hmac[0:8], 16) < houseEdge * 0xFFFFFFFF  →  crash = 1.00x
   ```
5. Otherwise the first 52 bits map to a uniform `u ∈ [0,1)` and:
   ```
   crash = floor( (1 / (1 - u)) * 100 ) / 100
   ```
   This is the standard crash distribution: median ≈ 2x, heavy tail.

## Verification
- After a server seed rotates (every 24h), the raw `serverSeed` is revealed and
  written onto every round that used it (`Round.serverSeed`).
- Anyone can recompute a round with the public endpoint:
  ```
  GET /api/game/verify?serverSeed=...&clientSeed=...&nonce=...
  ```
  or on the `/fairness` page. The returned `crashPoint`, `serverSeedHash` and `hmac`
  must match what was shown live.

## Why it's fair
- The server commits to `serverSeed` **before** seeing any bets (hash is public).
- The server cannot change `serverSeed` later without breaking the published hash.
- The outcome is a pure function of `(serverSeed, clientSeed, nonce)` — no bet data
  feeds into it — so the result is fixed the moment betting opens.

See `backend/src/utils/provablyFair.ts` and its unit tests in
`backend/src/__tests__/provablyFair.test.ts`.
