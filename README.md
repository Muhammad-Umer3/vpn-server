# VPN Control API

Backend for a freemium VPN app with ad-based rewards. Handles device registration, usage tracking, rewards (AdMob), and per-user WireGuard config distribution.

## Features

- **Device registration** – Anonymous auth via device ID (no signup)
- **Usage tracking** – 30 min/day free, daily bandwidth cap (default 1GB), server-side enforcement
- **Rewards** – +20 min per rewarded ad (AdMob or other networks)
- **Per-user WireGuard** – Unique peer config per device, revocable
- **Session tracking** – Start/end session with minutes and data usage

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Database

Create PostgreSQL database and run schema:

```bash
createdb vpn_control
psql vpn_control -f db/schema.sql
```

Or with env:

```bash
export DATABASE_URL=postgresql://user:pass@localhost:5432/vpn_control
psql $DATABASE_URL -f db/schema.sql
```

For existing databases, run migrations:

```bash
psql $DATABASE_URL -f db/migrations/001_add_reward_bytes.sql
```

### 3. Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:

- `DATABASE_URL` – PostgreSQL connection string
- `JWT_SECRET` – For token signing (optional, uses random tokens for now)
- `WG_SERVER_PUBLIC_KEY`, `WG_SERVER_ENDPOINT` – For WireGuard (after server setup)
- `DAILY_BANDWIDTH_MB` – Daily data cap in MB (default: 1024 = 1GB)
- `REWARD_MB_PER_AD` – Extra bandwidth per rewarded ad in MB (default: 300)

### 4. Run

```bash
npm run dev
```

### 5. WireGuard server (DigitalOcean)

On your droplet:

```bash
chmod +x scripts/wireguard-setup.sh
sudo ./scripts/wireguard-setup.sh
```

Then add the printed server public key and endpoint to `.env`.

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Register device, returns `device_token` |
| GET | `/api/usage` | Yes | Get remaining minutes, usage stats |
| POST | `/api/reward` | Yes | Claim ad reward (+20 min) |
| POST | `/api/session/start` | Yes | Start VPN session |
| POST | `/api/session/end` | Yes | End session, report usage |
| GET | `/api/config` | Yes | Get WireGuard config (requires remaining time) |
| GET | `/api/servers` | No | List VPN server regions |
| GET | `/health` | No | Health check |

**Auth:** Send `Authorization: Bearer <device_token>` or `device_token` in body/query.

## Android Integration

1. **Register** – Call `POST /api/register` with `device_id` (Android ID or UUID). Store `device_token`.
2. **Before connect** – Call `GET /api/config`. If `remaining_minutes > 0`, use returned `config.config_string` for WireGuard.
3. **AdMob** – After user watches rewarded ad, call `POST /api/reward` with `reward_type: "admob_rewarded"`.
4. **Session** – Call `POST /api/session/start` when VPN connects, `POST /api/session/end` with `minutes_used` and `data_bytes` when it disconnects.

## Deployment (DigitalOcean)

### Docker

```bash
npm run build
docker build -t vpn-control-api -f docker/Dockerfile .
```

### Scripts

- `scripts/wireguard-setup.sh` – WireGuard server setup on Ubuntu
- `scripts/deploy.sh` – Build and prepare for deployment
- `scripts/digitalocean-create.sh` – Create droplets via doctl

## License

MIT
