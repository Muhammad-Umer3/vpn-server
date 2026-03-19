# Securing Your API — Only Your App Can Call It

Step-by-step guide to restrict `api.zerologin.org` so only your genuine Android app can access sensitive endpoints.

---

## The Reality

You **cannot** fully hide the API from a decompiled app. The base URL lives in the app. Your goal is to:

1. **Verify the app** — Ensure requests come from your real app from the Play Store
2. **Make abuse costly** — Rate limits (already in place)
3. **Harden the server** — Firewall, HTTPS, monitoring

---

## Security Layers (Recommended Order)

### 1. Play Integrity API (Most Effective)

Google attests that the request comes from your real app on a real device. When enabled, `/api/config` and `/api/reward` require a valid `X-Play-Integrity-Token` header.

#### Server setup

1. **Google Cloud Console**
   - Create or select a project
   - Enable [Play Integrity API](https://console.cloud.google.com/apis/library/playintegrity.googleapis.com)
   - Create a service account with Play Integrity API access
   - Download the JSON key file

2. **Play Console**
   - Link your app to the same Google Cloud project
   - In **Play Integrity API** settings, add your server's service account email

3. **Deploy credentials**
   ```bash
   # On your server, copy the key file
   scp service-account.json root@146.190.160.34:/root/vpn-server/
   chmod 600 /root/vpn-server/service-account.json
   ```

4. **Configure `.env`**
   ```env
   PLAY_INTEGRITY_ENABLED=true
   PLAY_INTEGRITY_PACKAGE_NAME=org.zerologin.app
   GOOGLE_APPLICATION_CREDENTIALS=/root/vpn-server/service-account.json
   ```
   Replace `org.zerologin.app` with your app's package name.

5. **Restart the API**
   ```bash
   pm2 restart vpn-api
   ```

#### Android app setup

1. Add [Play Integrity API dependency](https://developer.android.com/google/play/integrity/setup)
2. Before calling `/api/config` or `/api/reward`, request a token:
   ```kotlin
   val nonce = UUID.randomUUID().toString() // or hash of request
   val integrityToken = integrityManager.requestIntegrityToken(
       IntegrityTokenRequest.builder().setNonce(nonce).build()
   ).get()
   ```
3. Send the token in the header:
   ```kotlin
   request.addHeader("X-Play-Integrity-Token", integrityToken.token())
   ```

**Note:** Until you enable this and update your app, leave `PLAY_INTEGRITY_ENABLED` unset. The API works without it.

---

### 2. Certificate Pinning (App-Side)

Pin your API's TLS certificate so the app only talks to your real server. Prevents MITM and redirects.

```bash
# Get your cert pin (run from any machine)
openssl s_client -connect api.zerologin.org:443 -servername api.zerologin.org 2>/dev/null | \
  openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | \
  openssl dgst -sha256 -binary | \
  openssl enc -base64
```

In your Android app (OkHttp):

```kotlin
val certificatePinner = CertificatePinner.Builder()
    .add("api.zerologin.org", "sha256/YOUR_PIN_HERE")
    .build()

OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build()
```

---

### 3. CORS (If Using WebView)

If your app uses a WebView that calls the API, tighten CORS:

```env
CORS_ORIGINS=https://zerologin.org,https://app.zerologin.org
```

Native Android apps typically don't send `Origin`, so CORS has limited effect. Use `*` or your domains.

---

### 4. ProGuard / R8 (App-Side)

Enable in `build.gradle` to obfuscate code and slow reverse engineering:

```gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

---

### 5. AdMob Server-Side Verification (Rewards)

The reward endpoint currently trusts the client. A decompiled app can spam `POST /api/reward` without watching ads.

**Fix:** Use [AdMob Server-Side Verification](https://developers.google.com/admob/android/rewarded-video-ssv). Your server receives a callback from AdMob when a user completes a rewarded ad, and only then credits the device. The app never directly calls `/api/reward` for rewards.

---

## Already Implemented

| Protection | Status |
|-----------|--------|
| Rate limit: API (100/15min) | ✅ |
| Rate limit: Register (10/hr) | ✅ |
| Rate limit: Reward (5/hr) | ✅ |
| Rate limit: Config (30/15min) | ✅ |
| Auth on sensitive endpoints | ✅ |
| HTTPS (nginx + Let's Encrypt) | ✅ |
| Trust proxy (X-Forwarded-For) | ✅ |

---

## Quick Start (Minimal)

1. **Play Integrity** — Set up when your app is ready. Follow the server and app steps above.
2. **Certificate pinning** — Add to your app's OkHttp client.
3. **ProGuard** — Enable for release builds.

---

## References

- [Play Integrity API](https://developer.android.com/google/play/integrity)
- [AdMob Rewarded SSV](https://developers.google.com/admob/android/rewarded-video-ssv)
- [OkHttp Certificate Pinning](https://square.github.io/okhttp/4.x/okhttp/okhttp3/-certificate-pinner/)
