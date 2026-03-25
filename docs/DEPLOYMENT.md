# Deployment Guide — DigitalOcean (Option A)

Postgres and Redis run in Docker. API and WireGuard run on the host.

---

## 1. Prerequisites

- Ubuntu 22.04 Droplet
- Docker and Docker Compose installed
- SSH access

---

## 2. Start Postgres and Redis

```bash
cd /path/to/vpn-server

# Set a strong Postgres password (optional, has default)
export POSTGRES_PASSWORD=your_secure_password

docker compose up -d

# Verify
docker compose ps
```

Schema is applied automatically on first start via `db/schema.sql`.

**Security:** `docker-compose.yml` maps Postgres and Redis to `127.0.0.1` only. If you previously published `5432`/`6379` on all interfaces, recreate the stack so the droplet is not scanned as “open Redis” from the internet:

```bash
docker compose down
docker compose up -d
```

---

## 3. Configure Environment

Copy `.env.example` to `.env` and set:

```env
# API connects to localhost (containers expose ports)
DATABASE_URL=postgresql://vpn:your_secure_password@localhost:5432/vpn_control
REDIS_URL=redis://localhost:6379

# WireGuard (after running wireguard-setup.sh)
WG_SERVER_PUBLIC_KEY=<from wireguard-setup.sh output>
WG_SERVER_ENDPOINT=<droplet-ip>:51820
WG_CONFIG_PATH=/etc/wireguard/wg0.conf

# Production
NODE_ENV=production
JWT_SECRET=<generate-a-strong-secret>
```

---

## 4. Set Up WireGuard

```bash
sudo ./scripts/wireguard-setup.sh
```

Copy the printed `WG_SERVER_PUBLIC_KEY` and `WG_SERVER_ENDPOINT` into `.env`.

---

## 5. Run the API

```bash
npm run build
npm start
```

Or with PM2 for production:

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name vpn-api
pm2 save
pm2 startup
```

---

## 6. Firewall

```bash
sudo ufw allow 22/tcp
sudo ufw allow 51820/udp
sudo ufw allow 3000/tcp   # or 80/443 if behind nginx
sudo ufw enable
```

---

## Quick Reference

| Service   | Port | Runs In |
|-----------|------|---------|
| PostgreSQL| 5432 | Docker  |
| Redis     | 6379 | Docker  |
| API       | 3000 | Host    |
| WireGuard | 51820| Host    |
