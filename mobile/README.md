## Google sign-in

Google sign-in on mobile uses your **backend** to handle OAuth (works in the **iOS Simulator** with Expo Go). It does not need an iOS OAuth client or LAN JavaScript origins.

### 1. Google Cloud Console (web client)

On your existing **Web application** OAuth client:

1. **Authorized redirect URIs** — add:
   - `http://127.0.0.1:8000/auth/google/mobile/callback`
   - `http://localhost:8000/auth/google/mobile/callback`
2. Copy the **Client secret** (Credentials → your web client → Client secret)

### 2. Backend `.env`

```env
GOOGLE_CLIENT_ID=your-web-client-id
GOOGLE_CLIENT_SECRET=your-web-client-secret
API_BASE_URL=http://127.0.0.1:8000
```

Restart `npm run dev` after saving.

### 3. Mobile `.env`

```env
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-web-client-id
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000
```

Reload the app after changes.

### Limits

| Environment | Google sign-in |
|---|---|
| **iOS Simulator** (dev build) | Works |
| **Physical iPhone** | Use a dev build (`npm run ios:device`) or email sign-in |
| **OAuth consent screen in Testing** | Add your Google account as a test user |

### Running on iOS (SDK 56)

**Expo Go from the App Store does not support SDK 56.** Use a development build instead:

```bash
# One-time: build and install on the iOS Simulator (~5–10 min)
cd mobile && npm run ios:sim

# Daily dev: start Metro and open the simulator app
npm run ios
```

Ensure `npm run dev` is running at the repo root so the API is on port 8000.

Sign-in opens **Safari** → Google → back to the app.
