# 🔐 Security Audit & Hardening Report

White-box penetration test of the Aviator platform, focused on the high-value targets for a
money game: **betting integrity, account/authorization, and fund theft.** Tested by running the
server and attacking it, plus code review. All findings were fixed and re-verified.

---

## Result summary

| # | Attack | Severity | Before | After |
|---|---|---|---|---|
| 1 | **Cash out *above* the crash point** | HIGH | ❌ Possible | ✅ Fixed |
| 2 | Auto-cashout denied on same-tick crash (house-favor) | MED (fairness) | ❌ Possible | ✅ Fixed |
| 3 | **Socket flood** (bet/cashout/chat spam) | MED | ❌ No limit | ✅ Fixed |
| 4 | **Multi-account welcome-bonus farming** | MED | ❌ Unlimited | ✅ Mitigated |
| 5 | **Transfer not atomic** (money could vanish) | MED | ❌ Possible | ✅ Fixed |
| 6 | Admin force-crash breaks provably-fair | HIGH (prod) | ⚠️ Always on | ✅ Gated |
| 7 | Forged `alg=none` admin JWT | CRIT | ✅ Blocked | ✅ Blocked |
| 8 | Privilege escalation (user → admin route) | CRIT | ✅ Blocked | ✅ Blocked |
| 9 | Mass-assignment (self-grant role/balance) | CRIT | ✅ Blocked | ✅ Blocked |
| 10 | NoSQL-injection auth bypass | CRIT | ✅ Blocked | ✅ Blocked |
| 11 | Inflate balance via negative withdraw/transfer/deposit | CRIT | ✅ Blocked | ✅ Blocked |
| 12 | IDOR (read others' bets/transactions) | HIGH | ✅ Blocked | ✅ Blocked |
| 13 | Double-spend (double-click bet / double-cashout / concurrent withdraw) | HIGH | ✅ Blocked* | ✅ Blocked |

\* fixed in earlier hardening passes (slot reservation, atomic `$inc`, status guards).

---

## Vulnerabilities found & fixed

### 1. Cash out above the crash point — HIGH (money leak)
**Found by code review.** The crash is detected only on the 100 ms game tick, but `cashout()`
settled at the **continuous real-time multiplier** with no comparison to the crash point. In the
≤100 ms window between the multiplier crossing the crash point and the next tick firing the crash,
a cashout returned a multiplier **≥ the crash point** — paying out a bet that should have lost.
A scripted client cashing out late would leak house funds systematically.
**Fix** (`gameEngine.cashout`): if the live multiplier has reached the crash point, reject the
cashout and crash the round immediately — a player can never be paid at/above the crash point.

### 2. Auto-cashout denied on a same-tick crash — fairness
If one tick jumped past both an auto-cashout target *and* the crash point, the crash fired first and
the deserved auto-cashout (target < crash) was denied (house-favor).
**Fix** (`gameEngine.tick`): settle auto-cashouts whose target is below the crash point at their
target *before* crashing. Plus `crash()` is now idempotent.

### 3. No rate limiting on realtime (socket) actions — MED (DoS / spam)
`placeBet`, `cashout`, `chat`, `typing` had no throttle — 60/60 chat-flood messages were accepted.
**Fix** (`socket/index.ts`): per-socket fixed-window limits (bet 12/5s, cashout 20/5s, chat 5/10s,
typing 15/10s). Verified: flood dropped to 5/40.

### 4. Multi-account bonus farming — MED (economic abuse)
Every signup granted ₹100 with no email verification → unlimited free credits via throwaway accounts.
**Fix:** per-IP registration limiter (`MAX_REGISTRATIONS_PER_HOUR`, default 5 — verified 5 created
then `429`) and a configurable/disable-able `WELCOME_BONUS` / `REFERRAL_BONUS`. **Full fix for real
money = enforce email verification + device fingerprinting + KYC** (see residual risks).

### 5. Transfer not atomic — MED (money integrity)
Player-to-player transfer debited the sender then credited the recipient as two separate ops; a
failure in between could destroy funds.
**Fix** (`userController.transfer`): if the recipient credit fails, the sender is automatically
refunded (compensating transaction).

### 6. Admin force-crash breaks provably-fair — HIGH for production
The admin "force crash" overrides the outcome while the round still looks provably-fair.
**Fix:** gated behind `ALLOW_FORCE_CRASH` (default on for dev) — set `ALLOW_FORCE_CRASH=false` in
production and the endpoint returns 403.

## What already held up (no change needed)
- **Auth/authz:** forged `alg=none` JWT → 401; non-admin → admin route 403; tokens HS256-signed.
- **NoSQL injection:** Zod string validation rejects `{$ne:…}` / `{$gt:…}` login payloads → 400.
- **Mass-assignment:** profile update whitelists `avatar/bio/username` only — role/balance unchanged.
- **Negative-amount money creation:** withdraw/transfer/deposit all reject ≤0 → 400.
- **IDOR:** user endpoints scope by the JWT subject; `userId` query params are ignored.
- **Double-spend:** synchronous slot reservation + atomic conditional `$inc` + status guards.
- **Stripe:** webhook signature verified; credited amount == paid amount.
- **XSS:** React auto-escapes chat/usernames; username regex blocks markup; avatars aren't rendered.
- **Secrets:** never committed; `passwordHash`/tokens stripped from all API responses; bcrypt(12).

---

## Residual risks & recommendations (before real-money launch)
1. **Email verification + 2FA enforcement** — fields/endpoints exist but aren't enforced. Required to
   stop bonus farming and account takeover at scale.
2. **KYC / AML** — identity + source-of-funds checks; transaction monitoring; the alert system
   (large bet/win/withdrawal) is a foundation but needs case management + SAR workflows.
3. **Access token in `localStorage`** — convenient but XSS-exposed. With no current XSS this is
   acceptable; for defense-in-depth consider in-memory tokens + a strict CSP.
4. **Disable `ALLOW_FORCE_CRASH`** and remove/limit any outcome-override tooling in production.
5. **TLS, secret rotation, WAF/DDoS** at the edge; per-user/global bet exposure limits; audit-log
   immutability; responsible-gambling controls (deposit/loss limits, self-exclusion).
6. **Re-verify provably-fair publicly** — the algorithm is sound (audited: organic rounds recompute
   exactly); keep publishing seed hashes and revealing seeds on rotation.

*All code-level findings above are fixed, verified, and committed. The residual items are
product/compliance work needed for a licensed real-money operation.*
