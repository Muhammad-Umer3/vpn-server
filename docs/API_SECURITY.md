# API & WireGuard Server Security

Protecting your VPN API and WireGuard server from decompiled apps and abuse.

---

## The Reality

**You cannot hide the API from a decompiled app.** The base URL and endpoint paths must live in the app. A determined attacker can extract them. Your goal is to:

1. **Make abuse costly** — rate limits, attestation, abuse detection
2. **Verify request legitimacy** — ensure requests come from your real app, not a script
3. **Harden the server** — firewall, monitoring, minimal exposure

---

## 1. App-Side Protections (Android)

### 1.1 ProGuard / R8 Obfuscation

Enable in `build.gradle`:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

Add custom rules to obfuscate API strings (use NDK or encode at build time):

```proguard
# Keep API models if using Retrofit/Gson
-keep class com.zerologin.api.** { *; }

# Obfuscate everything else
-keepattributes Signature
-keepattributes *Annotation*
```

**Note:** ProGuard obfuscates code, not strings. The API URL will still be extractable. Use it to slow down reverse engineering.

### 1.2 Certificate Pinning

Pin your API's TLS certificate so the app only talks to your real server. Prevents MITM and redirects.

```kotlin
// OkHttp certificate pinning
val certificatePinner = CertificatePinner.Builder()
    .add("api.zerologin.org", "sha256/YOUR_PIN_HERE")
    .build()

OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

Get your cert's pin: `openssl s_client -connect api.zerologin.org:443 -servername api.zerologin.org 2>/dev/null | openssl x509 -pubkey -noout | openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | openssl enc -base64`

### 1.3 Play Integrity API (Critical)

**This is the most effective protection.** The app requests an integrity token before sensitive operations (connect, reward). The server verifies the token with Google. Google attests:

- Device is genuine (not emulator)
- App is the real, unmodified binary from Play Store
- Request comes from a real device

**Flow:**
1. App calls `IntegrityManager.requestIntegrityToken()` with a nonce
2. App sends token to your API (e.g. in `X-Play-Integrity-Token` header)
3. Server calls Google's Play Integrity API to verify
4. Server only proceeds if verdict is `MEETS_DEVICE_INTEGRITY` and `MEETS_APP_INTEGRITY`

**Setup:** [Play Integrity API Setup](https://developer.android.com/google/play/integrity/setup)

**Server verification:** Use Google's REST API or the `google-auth-library` + `playintegrity` package. See [Standard API Request](https://developer.android.com/google/play/integrity/standard).

### 1.4 Root / Tamper Detection

Reject or warn on rooted devices. Libraries: RootBeer, SafetyNet (deprecated). Play Integrity covers some of this.

### 1.5 Never Hardcode Secrets

- No API keys in the app
- No WireGuard server keys in the app
- `device_token` is issued by the server after registration — good

---

## 2. API-Side Protections (This Server)

### 2.1 Implemented

| Protection | Status |
|------------|--------|
| Rate limit: API (100/15min) | ✅ |
| Rate limit: Register (10/hr) | ✅ |
| Rate limit: Reward (5/hr per IP) | ✅ (see below) |
| Daily reward cap per device | ✅ (see below) |
| Rate limit: Config | ✅ |
| Rate limit: Servers | ✅ |
| Auth on sensitive endpoints | ✅ |

### 2.2 Play Integrity Middleware (Implemented)

Middleware verifies `X-Play-Integrity-Token` for `/api/register`, `/api/config`, and `/api/reward` when enabled. If the token is missing or invalid, returns 403. See `docs/SECURITY_SETUP.md` for setup.

Requires in `.env` when enabling:
- `PLAY_INTEGRITY_ENABLED=true`
- `PLAY_INTEGRITY_PACKAGE_NAME` (your app package)
- `GOOGLE_APPLICATION_CREDENTIALS` (path to service account JSON)

### 2.3 AdMob Server-Side Verification (SSV)

The reward endpoint currently trusts the client. A decompiled app can spam `POST /api/reward` without watching ads.

**Fix:** Use [AdMob Server-Side Verification](https://developers.google.com/admob/android/rewarded-video-ssv). Flow:

1. App shows rewarded ad
2. On completion, AdMob sends a server callback to your webhook with a signed token
3. Your server verifies the token and credits the device
4. App polls or uses push to refresh usage

The app never directly calls `/api/reward` — it only triggers the ad. Your server only credits when AdMob confirms.

---

## 3. WireGuard Server Hardening

### 3.1 What Gets Exposed

The WireGuard endpoint (host:port) and server public key are in the config response. That's unavoidable — the client needs them to connect. Only authenticated devices get config.

### 3.2 Firewall Rules

```bash
# Allow WireGuard UDP only
ufw allow 51820/udp
ufw allow 22/tcp   # SSH
ufw enable

# Optional: Restrict WireGuard to your API server's IP if they're separate
# ufw allow from <API_SERVER_IP> to any port 51820 proto udp
```

### 3.3 WireGuard Config

- Use a strong `ListenPort` (default 51820)
- Keep `wg0.conf` permissions: `chmod 600`
- Rotate server key periodically (requires re-issuing configs to all peers)

### 3.4 Separate API and WireGuard

- API server: handles auth, config, rewards
- WireGuard server: only runs `wg`, receives VPN traffic

The API never exposes the WireGuard private key. Only the public key and endpoint are in config.

---

## 4. Infrastructure

### 4.1 Reverse Proxy / WAF

Put Cloudflare or similar in front of your API:

- DDoS protection
- Bot detection
- Rate limiting at edge
- Hide origin IP

### 4.2 CORS

Tighten `CORS_ORIGINS` in production. Don't use `*` if the API is only called from your app (which uses a custom scheme or WebView).

### 4.3 Monitoring

- Log failed auth attempts
- Alert on unusual reward spikes
- Monitor `/api/config` call volume

---

## 5. Summary Checklist

| Layer | Action |
|-------|--------|
| **App** | ProGuard, certificate pinning, Play Integrity |
| **API** | Rate limits, reward cap, optional Play Integrity middleware |
| **Rewards** | Migrate to AdMob SSV when possible |
| **WireGuard** | Firewall, minimal exposure, no private key in API |
| **Infra** | WAF, CORS, monitoring |

---

## References

- [Play Integrity API](https://developer.android.com/google/play/integrity)
- [AdMob Rewarded SSV](https://developers.google.com/admob/android/rewarded-video-ssv)
- [OkHttp Certificate Pinning](https://square.github.io/okhttp/4.x/okhttp/okhttp3/-certificate-pinner/)
