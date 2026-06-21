# Your Cook Mate

Turn any pasted recipe into clear, step-by-step cooking cards.

## Phase 1 — Local development

### Prerequisites

- Node.js 20+
- Python 3.12+
- Docker (optional, for Postgres scaffold)

## Phase 2 — Accounts & library

- **Sign up / sign in** with email, Google, or Apple at `/register` and `/login`
- **My recipes** at `/recipes` — saved to PostgreSQL, searchable
- Guests can still parse and cook without an account (browser-only storage)

### OAuth setup (optional)

Add to `backend/.env` and `web/.env`:

```
GOOGLE_CLIENT_ID=your-google-client-id
VITE_GOOGLE_CLIENT_ID=your-google-client-id

APPLE_CLIENT_ID=your.apple.service.id
VITE_APPLE_CLIENT_ID=your.apple.service.id
```

OAuth buttons appear only when client IDs are configured.

### Quick start

From the project root:

```bash
npm run setup   # Python venv, backend deps, web deps, backend/.env
npm run dev     # Starts API (localhost:8000) + web (localhost:5173)
```

Open [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` to the backend.

Optional: add `OPENAI_API_KEY` to `backend/.env` for AI-powered parsing (otherwise a fallback parser is used).

### Manual setup

<details>
<summary>Run backend and web separately</summary>

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

**Web app**

```bash
cd web
npm install
npm run dev
```

</details>

### Docker Compose (optional)

Runs Postgres + backend together:

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

Postgres is scaffolded for Phase 2; Phase 1 uses browser localStorage only.

### Flow

1. **Paste** a recipe on `/new`
2. **Review** parsed steps and ingredients
3. **Cook** — full-screen step cards with swipe, timers, and ingredient drawer

Recipes are saved in `localStorage` (no account required in Phase 1).

### API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/recipes/parse` | `{ "raw_text": "..." }` → structured recipe |

Without `OPENAI_API_KEY`, a heuristic fallback parser is used.

See [REFERENCE.md](./REFERENCE.md) for the full product plan.

## iOS app

Expo mobile app in [`mobile/`](./mobile/). See [mobile/README.md](./mobile/README.md).

```bash
npm run dev    # backend + web
npm run ios    # iOS Simulator (separate terminal)
```
