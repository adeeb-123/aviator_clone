# Dev Deployment — Railway (PaaS) + Atlas + Redis Cloud + Stripe TEST

Two Railway services in one project, deployed from this monorepo via the Railway CLI
(no GitHub required). MongoDB Atlas + Redis Cloud are external managed stores.

```
            ┌── Railway project: aviator-dev ──────────────────┐
 testers ──▶│  frontend (Next.js)  ──HTTP/WS──▶  backend (Node) │──▶ Atlas (Mongo)
            │  *.up.railway.app                  *.up.railway.app│──▶ Redis Cloud
            └──────────────────────────────────────────────────┘──▶ Stripe (test)
```

## Prereqers
- Railway account + **project token** (`RAILWAY_TOKEN`) — Project → Settings → Tokens.
- Railway CLI: `npm i -g @railway/cli` (installed at deploy time).
- Atlas `MONGODB_URI`, Redis Cloud `REDIS_URL`, Stripe test `sk_test_…`.

## Deploy order (URLs depend on each other)
1. **Create project + services**
   ```bash
   railway login                # or export RAILWAY_TOKEN=...
   railway init -n aviator-dev
   railway add -s backend
   railway add -s frontend
   ```
2. **Backend service vars** (Project → backend → Variables), then deploy:
   ```bash
   cd backend && railway up -s backend
   ```
   Grab its public URL → `https://aviator-backend-xxxx.up.railway.app`.
3. **Frontend service vars** — set `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_SOCKET_URL`
   to the backend URL (these are build args), then:
   ```bash
   cd ../frontend && railway up -s frontend
   ```
   Grab its public URL → `https://aviator-frontend-xxxx.up.railway.app`.
4. **Back-fill cross-URL vars**: set backend `FRONTEND_URL` = frontend URL, redeploy backend.
5. **Stripe webhook**: in Stripe (test) → Developers → Webhooks → add endpoint
   `https://<backend-url>/api/payments/webhook`, event `checkout.session.completed`.
   Copy the signing secret → backend `STRIPE_WEBHOOK_SECRET`, redeploy backend.
6. **Seed admin**: `railway run -s backend npm run seed:admin` (or it auto-seeds on first boot if enabled).

## Environment variables

### backend service
| Var | Source | Example / note |
|---|---|---|
| `NODE_ENV` | fixed | `production` |
| `MONGODB_URI` | Atlas | `mongodb+srv://user:pass@cluster.mongodb.net/aviator` |
| `REDIS_URL` | Redis Cloud | `rediss://default:pass@host:port` |
| `JWT_SECRET` | generated | 64-hex random |
| `JWT_REFRESH_SECRET` | generated | 64-hex random |
| `STRIPE_SECRET_KEY` | Stripe test | `sk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | Stripe (step 5) | `whsec_…` |
| `FRONTEND_URL` | step 4 | frontend public URL (CORS + Stripe redirect) |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | you | admin login |
| `HOUSE_EDGE` `MIN_BET` `MAX_BET` `BETTING_WINDOW_MS` `ROUND_PAUSE_MS` | optional | defaults fine |
| `PORT` | Railway-injected | do **not** set |

### frontend service
| Var | Source | Note |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | backend URL | **build arg** — set before deploy |
| `NEXT_PUBLIC_SOCKET_URL` | backend URL | **build arg** — set before deploy |
| `PORT` | Railway-injected | do **not** set |

## Notes
- Atlas → Network Access: allow `0.0.0.0/0` (Railway egress IPs are dynamic) for dev.
- Single backend instance runs the authoritative game loop; the Redis adapter is active
  but do not scale the backend to >1 replica (one game-loop writer only).
- Cross-domain auth: refresh cookie is `SameSite=None; Secure` in prod; the access token
  travels in the `Authorization` header, so login works across the two subdomains.
- This is **dev / test**: Stripe in TEST mode, play-money economy, not for real wagering.
