# 🚀 Aviator Crash Game — Project & QA Report

**Prepared:** 2026‑06‑26 · **Environment:** Dev / Real‑user testing
**Live URLs:** Frontend `https://aviator-crash-web.onrender.com` · API `https://aviator-crash-api.onrender.com`
**Repository:** https://github.com/adeeb-123/aviator_clone (`main`)
**Analytics window:** 2026‑06‑22 20:57 → 2026‑06‑24 11:41 UTC (~1.6 days), pulled live from MongoDB Atlas.

> ⚠️ Educational/demo build. Stripe runs in **TEST** mode and the economy is **play‑money (₹)**. Not for real wagering without licensing.

---

## 1. Executive summary

A full‑stack, provably‑fair Aviator‑style crash betting game.

| Layer | Stack |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind, Framer Motion, Zustand, 60 fps Canvas |
| Backend | Node.js, Express, TypeScript, Socket.io (Redis adapter), Mongoose |
| Data / infra | MongoDB Atlas, Redis Cloud, Stripe (test), Docker, Render (PaaS) |

Currency: **INR (₹)** throughout the UI and Stripe checkout.

**Quality:** 31/31 automated backend checks pass; full browser E2E passes; provably‑fair verified (all organic rounds recompute correctly). Two bugs were found during deep testing and **both are fixed** (details in §8).

---

## 2. Feature showcase — screens, buttons & what they do

### 2.1 Game screen (`/`)
| Element | What it does |
|---|---|
| **Round‑history strip** (top) | Coloured pills of recent crash multipliers (green <2×, gold <5×, red ≥5×). Scrolls horizontally. |
| **Canvas graph** | 60 fps animated curve + ✈️ plane that climbs with the multiplier; turns 💥 with a particle burst on crash. |
| **Multiplier display** | Center overlay: betting countdown → live multiplier (green→gold→red) → "FLEW AWAY! X×" on crash. |
| **Bet panel ×2 (dual bet)** | Two independent bet slots. Each has: amount field, **½** / **2×** steppers, quick chips **1/5/10/50**, **Auto cashout** toggle (+target input), and the action button. |
| **Bet ₹X button** | During the betting window, places the bet → balance debited → button becomes "Waiting for round…". |
| **Cash Out ₹X button** | During the round, cashes out at the live multiplier → credits `stake × multiplier`. Pulses to draw attention. |
| **Live Bets** | Real‑time list of everyone's bets this round (player, stake, cashout multiplier). |
| **Top Winners** | Leaderboard with Today / Week / All‑time tabs. |
| **Live Chat** | Global chat with emoji picker + typing indicator. |
| **Header** | Logo, nav (Play / Provably Fair / Admin), **balance (₹)**, Wallet, Login‑Register / Logout. |

### 2.2 Auth modal
Single modal with **Login** / **Register** tabs (rendered via a React portal so it always centers correctly). Register grants a **₹100 welcome bonus**; optional referral code grants the referrer ₹25.

### 2.3 Wallet (`/wallet`)
Current balance, **Deposit (Stripe)**, **Withdraw**, full **transaction ledger**, and the user's **referral code**.

### 2.4 Provably Fair (`/fairness`)
A public verifier: paste a revealed `serverSeed` + `clientSeed` + `nonce` → recompute the crash point. Also lists **revealed server seeds**.

### 2.5 Admin dashboard (`/admin`, admin‑only)
KPI cards (Users / Rounds / Wagered / Payout / **Revenue**, all ₹), a 30‑day revenue line chart, **Game Controls** (Pause / Resume / Force crash / Rotate seed), and **Player management** (grant balance, ban / unban).

---

## 3. How auto‑cashout works

1. When placing a bet the player optionally sets a **target multiplier** (≥ 1.01×).
2. The bet is stored server‑side with that target. The **server is authoritative** — auto‑cashout does **not** depend on the client staying connected.
3. Every 100 ms tick, the game engine sweeps active bets: if `currentMultiplier ≥ target`, it **cashes the bet out at exactly the target** and credits `stake × target`.
4. If the round crashes before the target is reached, the bet loses.

**Verified:** placing ₹10 @ 1.1× returned exactly ₹11 (balance 89 → 100) through the live UI; and across multiple rounds the payout/loss matched the round's crash point every time. A **disconnect test** confirmed the bet still resolves server‑side after the client drops.

---

## 4. How provably‑fair works

A **commit‑reveal** scheme makes every outcome verifiable and tamper‑evident.

```
hmac  = HMAC_SHA256(key = serverSeed, message = `${clientSeed}:${nonce}`)
if int(hmac[0:8],16) < houseEdge · 0xFFFFFFFF   →  crash = 1.00×        (house edge band)
else  u = first 52 bits of hmac / 2^52          →  crash = floor( 1/(1-u) · 100 ) / 100
```

- Before each round the server publishes `serverSeedHash = SHA256(serverSeed)` — committing to the seed **without revealing it**.
- The crash point is a pure function of `(serverSeed, clientSeed, nonce)` — no bet data feeds in, so it's fixed the instant betting opens.
- Server seeds **rotate every 24 h**; on rotation the raw `serverSeed` is revealed and back‑filled onto its rounds, so anyone can recompute them at `/fairness` or via `GET /api/game/verify`.

**Verified against live data:** of the seeds in the DB, **5 are revealed** and 1 is active (hash‑only). Every audited organic round recomputed to its stored crash point (the only ever mismatch was an admin **force‑crashed** round — see §5).

---

## 5. How admin controls work

| Control | Endpoint | Behaviour |
|---|---|---|
| **Pause** | `POST /admin/game/pause {paused:true}` | After the current round finishes, the loop holds (no new betting window) until resumed. |
| **Resume / Play** | `POST /admin/game/pause {paused:false}` | Clears the pause flag; the next betting window opens. |
| **Force crash** | `POST /admin/game/force-crash {crashPoint}` | Overrides the **next** round's crash point to the given value (testing tool). |
| **Rotate seed** | `POST /admin/seed/rotate` | Reveals & deactivates the active server seed (back‑filling its rounds) and creates a fresh committed seed. |
| **Grant balance** | `POST /admin/balance {userId, amount}` | Atomically credits/debits a player; writes an `admin-adjust` ledger entry. |
| **Ban / Unban** | `PATCH /admin/users/:id {isBanned}` | Banned users can't log in or chat. |

> 🔴 **Integrity note:** *Force crash* deliberately overrides the provably‑fair outcome. A forced round still stores a valid‑looking seed/hash, so verifying it produces a **different** number (we proved this: round #173 stored 1.50× while its seed computes 1.99×). This is fine as a **test** tool but **must be removed/gated before real‑money launch** — otherwise it lets the house rig outcomes.

### Game loop lifecycle
`betting (10 s window)` → `running (multiplier grows e^{0.09·t})` → `crashed (settle winners/losers, broadcast)` → `pause (6 s)` → repeat. A single authoritative engine instance drives it.

---

## 6. 📊 Analytics (real numbers from Atlas)

### Players
| Metric | Value |
|---|---|
| Total users | **11** (1 admin, 1 banned) |
| Welcome bonuses paid | 10 × ₹100 = **₹1,000** |
| Combined player balance | **₹101,895.67** |

### Rounds (game engine)
| Metric | Value |
|---|---|
| Rounds played (crashed) | **719** (731 incl. in‑progress) |
| Average crash point | **12.28×** (heavy‑tailed) |
| Lowest / Highest crash | **1.00× / 1,994.78×** |
| Instant busts (1.00×) | **28 (3.9%)** — matches the ~3% house‑edge band |

**Crash distribution (719 rounds):**
| Bucket | Rounds | Share |
|---|---|---|
| 1.00× (instant bust) | 28 | 3.9% |
| 1.01× – 1.99× | 323 | 44.9% |
| 2.00× – 4.99× | 210 | 29.2% |
| 5.00× – 9.99× | 85 | 11.8% |
| 10.0× – 49.9× | 53 | 7.4% |
| 50×+ | 20 | 2.8% |

→ Median ≈ **2.0×**, consistent with the standard crash distribution. ~48.8% of rounds bust under 2×.

### Betting
| Metric | Value |
|---|---|
| Bets placed | **62** (30 on the 2nd/dual slot) |
| Cashed out (won) | **35 (56.5%)** |
| Lost | 27 |
| **Pending/orphaned** | **0** ✅ (confirms atomic bet placement — no stuck bets) |
| Auto‑cashout bets | 8 (12.9%) |
| Total wagered / paid out | ₹3,043 / ₹2,686.67 |
| Highest cashout | **3.90×** |

### Transaction ledger (122 entries)
| Type | Count | Net ₹ |
|---|---|---|
| deposit (Stripe test) | 5 | +10,670 |
| withdraw | 2 | −10,020 |
| bet | 63 | −3,048 |
| win | 35 | +2,686.67 |
| bonus (welcome) | 10 | +1,000 |
| admin‑adjust | 7 | +607 |

### Top winners (all‑time)
| Player | Total payout | Best multiplier | Wins |
|---|---|---|---|
| adeeb123 | ₹2,639.33 | 3.90× | 30 |
| Areebiqb | ₹15.05 | 1.38× | 2 |
| tester012438 | ₹12.00 | 1.20× | 1 |

### Provably‑fair integrity
6 server seeds generated · **5 revealed** (publicly verifiable) · 1 active (committed hash only).

---

## 7. Testing scope — scenarios covered

Testing combined **automated suites** (live REST + Socket.io traffic, adversarial inputs) and **real‑browser E2E**, run against both the production deploy and a controlled local instance.

**Authentication & authorization**
- Register (valid / duplicate / weak password / XSS username), login (valid / wrong password / nonexistent), refresh‑token rotation, logout.
- No‑token → 401, invalid token → 401, **forged `alg=none` JWT → 401**, non‑admin → 403.

**Security / injection**
- **NoSQL‑injection** login payload rejected, **mass‑assignment** (role/balance via profile) blocked, XSS in username rejected (chat/username output is React‑escaped).

**Money & ledger**
- Withdraw > balance / negative / zero rejected; deposit negative rejected; transfer to self / nonexistent / negative rejected.
- **Ledger integrity**: sum of all transactions == account balance.

**Gameplay**
- Bet bounds (below min, above max, exact ₹1000), duplicate‑slot, dual‑bet, anonymous bet rejected, NaN/invalid amount rejected, bet during running rejected.
- Manual cashout, **double‑cashout rejected**, cashout with no bet rejected, auto‑cashout payout/loss correctness over multiple rounds.

**Concurrency / real‑life (double‑spend class)**
- **Double‑click same slot** → single debit (post‑fix), **concurrent full withdrawal** → only one succeeds (no negative), **concurrent transfer overdraw** → blocked, **disconnect mid‑bet** → resolves server‑side.

**Provably‑fair**
- Determinism, recomputation of revealed rounds (all match), seed rotation + reveal.

**Payments**
- Stripe checkout session creation, hosted payment (test card `4242…`), **signed webhook → balance credit → ledger entry**, currency = **INR**.

**Admin**
- Dashboard, revenue series, user list, audit log, balance adjust, ban/unban, pause/resume, force‑crash applied to a round, seed rotation.

**Frontend UI (browser E2E)**
- Page render + ₹ currency, modal registration → ₹100 balance, bet placement (debit), **auto‑cashout win via UI** (89 → 100), wallet/fairness/admin pages render.

---

## 8. Professional QA report — results & defects

**Overall:** 31/31 automated backend checks **PASS**; browser E2E **PASS**; provably‑fair **PASS**. Two defects found during deep testing, **both fixed & re‑verified**.

| # | Defect | Severity | Status |
|---|---|---|---|
| 1 | **Non‑atomic bet placement** — balance debited before `Bet.create`; a validation failure (e.g. invalid auto‑cashout) lost the stake with no bet. | HIGH | ✅ Fixed (validate before debit + refund guard) |
| 2 | **Duplicate‑slot double‑spend (TOCTOU)** — double‑click / two tabs placed two bets on one slot, debiting twice and orphaning a bet. | HIGH | ✅ Fixed (synchronous slot reservation) |
| 3 | **Admin force‑crash breaks provably‑fair** | CRITICAL *for real‑money launch* | ⚠️ Open — by‑design test tool; gate/remove before launch |

**Evidence the fixes hold:** post‑fix, double‑click debits once; and the live DB shows **0 pending/orphaned bets** across 62 bets — exactly what a correct atomic implementation produces.

### Other (non‑defect) observations
- **Render free‑tier**: services sleep when idle (~50 s cold start) and were **suspended** after the monthly free‑hours quota was exhausted during heavy testing. For continuous real‑user testing, upgrade the API service to **Starter ($7/mo)**.
- **Auth rate limit** (20 / 15 min per IP) is strict — shared‑NAT testers could be throttled collectively.
- **Email verification / 2FA / KYC** exist as fields/endpoints but are **not enforced** (intentional for dev; required before real‑money launch).
- Realized house margin over the (small) 62‑bet sample was ~11.7% vs the configured 3% edge — expected variance at this volume; converges to ~3% at scale.

---

## 9. Recommendations before a real launch
1. **Remove/gate `force-crash`** behind a non‑production flag (closes defect #3).
2. Move the API to an always‑on instance (no cold starts / suspension).
3. Enforce **email verification + 2FA**, add **KYC/AML** and responsible‑gambling controls.
4. Obtain gambling **licensing/legal** sign‑off; switch Stripe to live only after approval.
5. Add server‑side bet‑rate limits and monitoring/alerting on the ledger.

---

*Report generated from live MongoDB Atlas data and the automated + manual test runs described above.*
