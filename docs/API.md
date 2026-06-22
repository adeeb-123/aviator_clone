# API Reference

Base URL: `http://localhost:5000/api`

Auth uses a short-lived **access token** (Bearer header) plus an httpOnly **refresh cookie**
(`/api/auth/refresh`). The frontend `axios` client refreshes automatically on `401`.

## Auth — `/auth`
| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/register` | – | `{ username, email, password, referralCode? }` | 100 credit welcome bonus |
| POST | `/login` | – | `{ email, password, twoFactorCode? }` | sets refresh cookie |
| POST | `/refresh` | cookie | – | rotates refresh token, returns new access token |
| POST | `/logout` | Bearer | – | revokes refresh token |
| GET  | `/verify-email?token=` | – | – | marks email verified |

## Users — `/users` (Bearer)
| Method | Path | Body |
|---|---|---|
| GET | `/me` | – |
| PATCH | `/me` | `{ avatar?, bio?, username? }` |
| GET | `/bets?page&limit&status` | – |
| GET | `/transactions?limit` | – |
| GET | `/favorites` | – |
| POST | `/favorites` | `{ name, amount, autoCashout? }` |
| DELETE | `/favorites/:name` | – |
| POST | `/transfer` | `{ toUsername, amount }` |

## Game — `/game` (public)
| Method | Path | Notes |
|---|---|---|
| GET | `/state` | current engine snapshot |
| GET | `/history?limit` | last crashed rounds |
| GET | `/stats` | aggregate stats |
| GET | `/leaderboard?range=today\|week\|all` | top winners |
| GET | `/round/:roundId` | round + bets |
| GET | `/verify?serverSeed&clientSeed&nonce&houseEdge?` | recompute crash point |
| GET | `/seeds` | revealed server seeds |

## Payments — `/payments`
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/checkout` | Bearer | `{ amount }` → Stripe Checkout URL |
| POST | `/withdraw` | Bearer | `{ amount }` |
| POST | `/webhook` | Stripe sig | raw body — credits balance on success |

## Admin — `/admin` (Bearer + role=admin)
| Method | Path | Body |
|---|---|---|
| GET | `/dashboard` | – |
| GET | `/revenue` | – |
| GET | `/users?q` | – |
| PATCH | `/users/:userId` | `{ isBanned?, isSuspended?, vipTier?, role? }` |
| POST | `/balance` | `{ userId, amount, reason? }` |
| GET | `/audit?limit` | – |
| POST | `/game/pause` | `{ paused }` |
| POST | `/game/force-crash` | `{ crashPoint }` |
| GET | `/seed` | – |
| POST | `/seed/rotate` | – |

## Socket.io events
**Server → client:** `state:init`, `round:betting`, `round:running`, `round:tick`,
`round:crashed`, `round:history`, `bet:placed`, `bet:cashout`, `players:update`,
`balance:update`, `chat:message`, `chat:typing`, `leaderboard:update`.

**Client → server (with ack callback):** `action:placeBet {slot, amount, autoCashout?}`,
`action:cashout {slot}`, `action:chat {message}`, `action:typing`.

Authenticate the socket by passing the access token in the handshake: `io(url, { auth: { token } })`.
