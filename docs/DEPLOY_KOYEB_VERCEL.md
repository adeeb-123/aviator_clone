# Free Deployment — Koyeb (backend, always-on) + Vercel (frontend)

Truly-free, always-on hosting. MongoDB Atlas + Redis Cloud + Stripe stay as-is.

```
            ┌── Vercel (Next.js, free) ──┐   HTTPS/WSS   ┌── Koyeb (Node, free, always-on) ──┐
 players ──▶│  *.vercel.app              │ ◀───────────▶ │  *.koyeb.app  (game loop runs 24/7)│──▶ Atlas
            └────────────────────────────┘               └────────────────────────────────────┘──▶ Redis Cloud
                                                                                                 └──▶ Stripe (test)
```

Why this split: the backend runs a **continuous game loop + WebSocket server**, so it needs an
**always-on** host (Koyeb free = 1 always-on service, no card). The Next.js frontend is perfect
on Vercel's free tier.

---

## Step 1 — Backend on Koyeb
1. Sign up at [koyeb.com](https://www.koyeb.com) (GitHub login is fine).
2. **Create Web Service → GitHub** → authorize Koyeb → pick repo **`adeeb-123/aviator_clone`**.
3. **Builder:** Dockerfile. **Work directory:** `backend` · **Dockerfile path:** `Dockerfile`
   (so the build context is `backend/`).
4. **Instance:** Free (Nano). **Region:** Frankfurt or Washington (closest free region).
5. **Ports / health check:** Koyeb injects `PORT` automatically (the app reads it). Set the
   **health check** to HTTP path **`/health`**.
6. **Environment variables** (paste your existing values):
   | Var | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | (your Atlas URI) |
   | `REDIS_URL` | (your Redis Cloud URL) |
   | `JWT_SECRET` / `JWT_REFRESH_SECRET` | (your secrets) |
   | `STRIPE_SECRET_KEY` | `sk_test_…` |
   | `STRIPE_WEBHOOK_SECRET` | set in Step 4 (use `whsec_pending` for now) |
   | `FRONTEND_URL` | set in Step 3 (use `https://localhost` for now) |
   | `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | your admin login |
   | `ALERT_*`, game config | optional (defaults apply) |
   > Do **not** set `PORT` — Koyeb provides it.
7. Deploy. Grab the public URL → e.g. `https://aviator-xxxx.koyeb.app`.
   Verify: `https://<koyeb-url>/health` → `{"status":"ok"}`.

## Step 2 — Frontend on Vercel
1. Sign up at [vercel.com](https://vercel.com) (GitHub login).
2. **Add New → Project** → import **`adeeb-123/aviator_clone`**.
3. **Root Directory:** `frontend` (click Edit → select `frontend`). Framework auto-detects **Next.js**.
4. **Environment Variables** (Production):
   | Var | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<koyeb-url>` |
   | `NEXT_PUBLIC_SOCKET_URL` | `https://<koyeb-url>` |
5. Deploy. Grab the URL → e.g. `https://aviator-clone.vercel.app`.

## Step 3 — Point the backend at the frontend
On Koyeb → service → Environment → set `FRONTEND_URL` = `https://<vercel-url>` → redeploy.
(Needed for CORS, the cross-site auth cookie, and Stripe redirects.)

## Step 4 — Stripe webhook
Stripe (TEST) → Developers → Webhooks → add endpoint
`https://<koyeb-url>/api/payments/webhook`, event `checkout.session.completed` →
copy the `whsec_…` → set `STRIPE_WEBHOOK_SECRET` on Koyeb → redeploy.

## Step 5 — Smoke test
- `https://<koyeb-url>/api/game/state` → live game JSON
- Open the Vercel URL → register, place a bet, cash out, check `/admin`.

## Notes
- **Always-on:** Koyeb free does not sleep, so the game loop runs continuously — no cold starts.
- **One game engine:** run only ONE backend instance (Koyeb free = 1) — never the Koyeb backend
  and a local/Render one against the same Atlas DB simultaneously (round-ID conflicts).
- **Auto-deploy:** both Koyeb and Vercel redeploy on every push to `main`.
- Cross-domain auth already handled (`SameSite=None; Secure` cookie in production).
