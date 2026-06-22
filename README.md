# 🚀 Aviator Clone — Production-Ready Crash Game

A full-stack, provably-fair Aviator-style crash betting game.

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion · Zustand · Canvas 60fps graph
- **Backend:** Node.js · Express · TypeScript · Socket.io (Redis adapter) · Mongoose
- **Infra:** MongoDB · Redis · Stripe (sandbox) · Docker Compose · Nginx

> ⚠️ **Disclaimer:** This is an educational/demonstration project for learning real-time
> game architecture, provably-fair systems, and full-stack TypeScript. Real-money
> gambling is heavily regulated. Do **not** deploy this for actual wagering without legal
> counsel and licensing.

---

## ✨ Features

### Core game
- Multiplier starts at `1.00x`, grows `+0.01x` every 100ms (exponential curve on the client graph).
- **Provably-fair** crash points: `SHA256(serverSeed + clientSeed + nonce)`.
- Server seed rotation (24h), client seed selection, public verification page.
- Round history + full statistics.
- Auto-cashout (target multiplier) + **dual bet** system.

### Realtime
- Socket.io events: round lifecycle, multiplier ticks, live bets, cashouts, chat, balances, leaderboard.
- Redis adapter → horizontal scaling across multiple backend instances.

### Users & money
- JWT auth with refresh-token rotation, optional email verification.
- Balance: deposit (Stripe sandbox), withdraw, bet/win/refund ledger via `Transaction` model.
- Bet history, favorite strategies.

### Admin
- Live game monitoring, manual start/stop, crash-point override (test mode).
- Player management (suspend/ban/adjust balance), audit logs, revenue analytics, settings, seed management.

### Social
- Live chat (emoji), daily/weekly/all-time leaderboards, top winners, referral hooks.

### Security
- Helmet, CORS, rate limiting, input validation (Zod), bcrypt, short-lived access tokens.

---

## 🏁 Quick start (Docker — recommended)

```bash
cd "Aviator Clone"
cp .env.example .env          # adjust secrets
docker compose up --build
```

- Frontend → http://localhost:3000
- Backend  → http://localhost:5000
- Nginx    → http://localhost:8080 (reverse proxy for both)

## ⚡ Zero-dependency local run (no Docker, no MongoDB, no Redis)

The fastest way to see it run. Uses an in-memory MongoDB and an in-memory cache
(Redis is skipped automatically — single instance only). Auto-seeds an admin.

```bash
# Terminal 1 — backend (downloads an in-memory Mongo binary on first run)
cd backend && npm install && npm run dev:local      # http://localhost:5000

# Terminal 2 — frontend
cd frontend && npm install && npm run dev           # http://localhost:3000
```
Admin login: `admin@aviator.local` / `Admin123!`. Data resets on restart.

## 🛠 Local development (with real MongoDB + Redis)

You need MongoDB + Redis running locally (or via Docker: `docker compose up mongodb redis`).

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run dev          # http://localhost:5000

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

### Seed an admin user
```bash
cd backend
npm run seed:admin   # creates admin@aviator.local / Admin123! (configurable in .env)
```

---

## 📚 Documentation
- [API reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Provably fair](docs/PROVABLY_FAIR.md)
- [Deployment](docs/DEPLOYMENT.md)

## 🧪 Tests
```bash
cd backend && npm test          # Jest unit + integration
```

## 📂 Structure
```
Aviator Clone/
├─ backend/      Express + Socket.io game server
├─ frontend/     Next.js 14 client
├─ nginx/        Reverse proxy config
├─ docs/         API / architecture / deployment guides
└─ docker-compose.yml
```
