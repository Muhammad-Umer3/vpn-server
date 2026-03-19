# Running the API Behind HTTPS

Put a reverse proxy (nginx or Caddy) in front of the Node.js API to handle SSL/TLS termination. The API keeps running on port 3000; the proxy listens on 443.

---

## Option A: Nginx + Let's Encrypt (Certbot)

### 1. Install nginx and Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Point your domain to the server

Ensure `api.zerologin.org` has an A record pointing to `146.190.160.34`.

### 3. Configure nginx

Copy the config (already set for api.zerologin.org):

```bash
sudo cp docker/nginx-https.conf /etc/nginx/sites-available/vpn-api
sudo ln -sf /etc/nginx/sites-available/vpn-api /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default   # optional, removes default site
```

### 4. Get SSL certificate

```bash
sudo certbot --nginx -d api.zerologin.org
```

Certbot will modify the nginx config to add SSL and set up auto-renewal.

### 5. Start nginx

```bash
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx
```

### 6. Firewall

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 51820/udp
sudo ufw allow 22/tcp
sudo ufw enable
```

### 7. Update CORS (optional)

If your app uses a specific origin, set in `.env`:

```env
CORS_ORIGINS=https://zerologin.org,https://app.zerologin.org
```

---

## Option B: Caddy (auto HTTPS, no Certbot)

Caddy automatically obtains and renews Let's Encrypt certificates.

### 1. Install Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

### 2. Configure Caddy

Create `/etc/caddy/Caddyfile`:

```
api.zerologin.org {
    reverse_proxy localhost:3000
}
```

### 3. Start Caddy

```bash
sudo systemctl enable caddy
sudo systemctl reload caddy
```

Caddy will automatically get an SSL certificate on first request.

---

## Verify

```bash
curl -I https://api.zerologin.org/health
```

You should see `HTTP/2 200` or similar.

---

## Summary

| Component | Port | Protocol |
|-----------|------|----------|
| Nginx/Caddy | 80, 443 | HTTP/HTTPS |
| API (Node.js) | 3000 | HTTP (localhost only) |
| WireGuard | 51820 | UDP |

The API stays on HTTP internally; only the proxy handles HTTPS. Clients connect to `https://api.zerologin.org`.
