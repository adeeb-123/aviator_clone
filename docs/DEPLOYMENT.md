# Deployment

## Docker Compose (all-in-one)
```bash
cp .env.example .env        # set JWT secrets, Stripe keys, admin creds
docker compose up --build -d
docker compose exec backend npm run seed:admin   # create the admin user
```
Services:
- `nginx`   → http://localhost:8080 (single entrypoint, proxies API + WS + frontend)
- `frontend`→ :3000
- `backend` → :5000
- `mongodb` → :27017, `redis` → :6379

## Environment variables
See `.env.example`. Critical for production:
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — long random strings.
- `MONGODB_URI`, `REDIS_URL`.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (point Stripe webhook to
  `/api/payments/webhook`).
- `FRONTEND_URL` — used for CORS + Stripe redirect URLs.
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` — baked into the frontend at build time.

## Production hardening checklist
- [ ] Terminate TLS at nginx / load balancer; force HTTPS.
- [ ] Set strong unique secrets; rotate `JWT_*`.
- [ ] Restrict Mongo/Redis to the internal network (don't publish ports).
- [ ] Run a single `GameEngine` instance; scale socket/API nodes behind the Redis adapter.
- [ ] Configure Stripe webhook signing secret and live keys.
- [ ] Enable structured log shipping (pino → your aggregator).
- [ ] Add a process manager / orchestrator health check on `/health`.

## Scaling notes
- Frontend is stateless → scale freely.
- API/socket nodes are stateless if the engine runs separately → scale freely.
- The authoritative game loop must be a singleton (one writer of round state).

## Tests
```bash
cd backend && npm test     # uses mongodb-memory-server, no external DB needed
```

## Load testing (suggested)
Use `artillery` or `k6` to open 1000 socket connections and emit `action:placeBet`
during the betting window; watch `/health` and Redis/Mongo CPU. The engine work per
tick is O(active bets), so the hot path is the per-tick broadcast — Socket.io with the
Redis adapter handles fan-out across nodes.
