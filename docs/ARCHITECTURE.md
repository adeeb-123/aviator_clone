# Architecture

```
                 ┌─────────────┐      WebSocket / HTTP      ┌──────────────┐
   Browser  ───▶ │  Next.js 14 │ ◀────────────────────────▶│  Express +   │
                 │  (frontend) │                            │  Socket.io   │
                 └─────────────┘                            │  (backend)   │
                                                            └──────┬───────┘
                                              ┌────────────────────┼────────────────┐
                                              ▼                     ▼                ▼
                                        ┌──────────┐         ┌────────────┐   ┌───────────┐
                                        │ MongoDB  │         │   Redis    │   │  Stripe   │
                                        │ (Mongoose)│        │ adapter +  │   │ (sandbox) │
                                        └──────────┘         │   cache    │   └───────────┘
                                                             └────────────┘
```

## Backend layers
- **config/** — env loading, Mongo + Redis connections.
- **models/** — Mongoose schemas (`User, Round, Bet, Transaction, Chat, ServerSeed`) with indexes.
- **utils/** — `provablyFair` (crypto), `jwt`, `logger` (pino), error helpers.
- **services/**
  - `gameEngine` — authoritative singleton round loop (betting → running → crashed → pause).
    Holds in-memory live bets for speed; persists rounds/bets/balances to Mongo.
  - `seedManager` — server-seed rotation (24h) + nonce allocation.
  - `ledger` — atomic balance mutations + `Transaction` audit entries (conditional
    `$inc` prevents negative balances under concurrency).
  - `leaderboard` — cached aggregations.
- **middleware/** — `auth` (JWT), `rateLimit`, `validate` (Zod), centralized `error`.
- **controllers/ + routes/** — REST surface.
- **socket/** — handshake auth, bet/cashout/chat handlers, Redis adapter for scale-out.

## The game loop
`GameEngine.beginBetting()` → opens `bettingWindowMs` window, commits round +
crash point (provably fair) → `beginRunning()` ticks every 100ms emitting the
exponential multiplier → on `multiplier >= crashPoint` settles losers, broadcasts
`round:crashed`, pauses `roundPauseMs`, repeats. Auto-cashouts are swept each tick.

## Horizontal scaling
The Socket.io **Redis adapter** lets multiple backend instances share broadcasts.
Note: the in-memory `GameEngine` is a singleton — for multi-instance deployments run
exactly **one** engine process (e.g. a dedicated "game" service) and have the others
act as stateless socket/API fan-out nodes subscribed to the same Redis channel.

## Frontend
- **Zustand** stores (`useAuth`, `useGame`) hold reactive state.
- `providers.tsx` is the single socket→store bridge.
- `GameCanvas` renders the curve/plane/particles at 60fps via `requestAnimationFrame`,
  reading `useGame.getState()` each frame (no React re-render per frame).
- App Router pages: `/` (game), `/wallet`, `/fairness`, `/admin`.
