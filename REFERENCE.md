# Your Cook Mate — Project Reference

> Living reference for product vision, architecture, and implementation.  
> Stack: **React** web + **React Native (Expo)** mobile + **Python/FastAPI** backend.

---

## Vision

**Your Cook Mate** turns any recipe — pasted text, uploaded PDF/image, or social media link — into a guided, step-by-step cooking experience: one clear action per screen, swipe/click to advance, ingredients visible when needed, optional timers.

---

## Confirmed Decisions

| Decision | Choice |
|---|---|
| Recipe input | Paste text, PDF/image upload, social links (Instagram/TikTok reels) |
| Authentication | Email/password, Google OAuth, Sign in with Apple |
| Platforms | Web app + **iOS (App Store)** + **Android (Google Play)** |
| Infrastructure | **Phases 1–4:** local only (Docker Compose) · **Phase 5+:** AWS |
| Monetization (Phase 5+) | **Free:** 1 AI upload, unlimited manual entry, 5 share views/mo · **Pro:** monthly subscription |
| Scope | Accounts, save, share, collections, meal planning |
| Stack | React (Vite + TS) web + React Native (Expo) mobile + FastAPI + PostgreSQL |

---

## Architecture Overview

```mermaid
flowchart LR
  subgraph input [InputSources]
    PasteText[PasteText]
    UploadFile[PDF_or_Image]
    SocialLink[Instagram_TikTok_URL]
  end
  subgraph ingest [IngestionPipeline]
    OCR[OCR_Vision]
    SocialResolver[SocialLinkResolver]
    Normalize[NormalizedRecipeText]
  end
  subgraph backend [FastAPIBackend]
    ParseAgent[AIRecipeParser]
    Store[(PostgreSQL)]
    FileStore[(ObjectStorage)]
  end
  subgraph output [Experience]
    CookMode[FlipThroughCookMode]
    Library[SavedRecipes]
    Planner[MealPlanner]
  end
  PasteText --> Normalize
  UploadFile --> OCR --> Normalize
  UploadFile --> FileStore
  SocialLink --> SocialResolver --> Normalize
  Normalize --> ParseAgent
  ParseAgent --> Store
  Store --> CookMode
  Store --> Library
  Store --> Planner
```

---

## Core User Flows

### 1. Add Recipe → Ingest → Parse → Cook

Upload page with **three tabs** (or unified drop zone):

| Input type | User action | Backend processing |
|---|---|---|
| **Text** | Paste recipe into textarea | Send directly to AI parser |
| **File** | Upload PDF or image (jpg/png/webp) | Extract text via PDF parser or OCR/vision; store original file |
| **Link** | Paste Instagram or TikTok reel URL | Resolve caption + transcript; optionally analyze video frames |

**Unified flow:**

1. All inputs normalize to `raw_text` (+ optional `source_metadata`)
2. AI agent structures text into title, servings, times, ingredients, atomic steps
3. User reviews/edits the parsed result (light edit, not a full editor)
4. User enters **Cook Mode** — full-screen, one step at a time

### 2. Cook Mode

- **One step per card** — short, imperative sentences
- **Step metadata** — estimated time, equipment, linked ingredients
- **Sticky ingredient strip** — tap to expand step-relevant ingredients
- **Timer chips** — start timer when step mentions duration ("simmer 10 minutes")
- **Progress** — "Step 3 of 12" + dot/bar indicator
- **Mobile-first** — swipe left/right; desktop uses arrow keys + buttons
- **Hands-free (Phase 2+)** — "Next step" voice command

### 3. Save, Share, Collections, Meal Planning

- **Save** — authenticated users persist parsed recipes
- **Share** — public link at `/r/{slug}` with "Save to my library"
- **Collections** — user folders (e.g. "Weeknight Dinners")
- **Meal planning** — drag recipes onto weekly calendar; launch cook mode from planner

> **Phases 1–4:** No paywall — unlimited AI and shares for local development and testing.  
> **Phase 5+:** Subscription tiers and usage limits apply (see §6 below).

### 4. Authentication (Phase 2)

Users can sign up or log in three ways:

| Method | Flow |
|---|---|
| **Email** | Register with email + password; login returns JWT |
| **Google** | Frontend Google Identity Services → ID token → backend verifies → JWT |
| **Apple** | Frontend Sign in with Apple → identity token → backend verifies → JWT |

**Auth page UX:**

- Single `/login` and `/register` page with email form plus "Continue with Google" and "Continue with Apple" buttons
- OAuth buttons work for both sign-up and sign-in (auto-create account on first OAuth login)
- If OAuth email matches an existing email account, prompt to link accounts or login with password

```mermaid
flowchart TD
  subgraph client [ReactFrontend]
    EmailForm[EmailRegisterOrLogin]
    GoogleBtn[GoogleSignInButton]
    AppleBtn[AppleSignInButton]
  end
  subgraph api [FastAPIBackend]
    VerifyEmail[VerifyCredentials]
    VerifyGoogle[VerifyGoogleIDToken]
    VerifyApple[VerifyAppleIdentityToken]
    IssueJWT[IssueAppJWT]
    UserStore[(users_table)]
  end
  EmailForm --> VerifyEmail
  GoogleBtn --> VerifyGoogle
  AppleBtn --> VerifyApple
  VerifyEmail --> IssueJWT
  VerifyGoogle --> UserStore
  VerifyApple --> UserStore
  UserStore --> IssueJWT
```

**Backend verification:**

- **Google:** Verify ID token with `google-auth` library against Google certs (`GOOGLE_CLIENT_ID`)
- **Apple:** Verify identity token with Apple's JWKS (`APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`)
- All successful auth paths issue the same app JWT for API access

**Account linking (V1):**

- One user row per email; OAuth providers stored in `oauth_accounts` table
- OAuth-only users have `password_hash = null`
- Defer "link Google to existing email account" UI to post-MVP if needed

### 5. Mobile Apps — iOS & Android (Phase 5)

Native apps on the **Apple App Store** and **Google Play Store**, built with **Expo (React Native)** so the mobile and web clients share the same backend and much of the same logic.

**Why Expo / React Native:**

- Same React ecosystem as the web app
- One mobile codebase for iOS and Android
- **EAS Build** handles App Store and Play Store builds/submissions
- Native APIs: camera, photo library, keep-awake, haptics, share sheet
- Apple Sign In and Google Sign-In have first-class Expo/React Native SDKs

**Monorepo layout:**

```
YourCookMate/
├── web/                      # React (Vite + TypeScript) — browser
├── mobile/                   # Expo (React Native) — iOS + Android
├── backend/                  # FastAPI
├── shared/                   # Shared TypeScript: API types, validators, constants
├── docker-compose.yml
└── REFERENCE.md
```

**Web vs mobile — shared vs native:**

| Layer | Shared | Platform-specific |
|---|---|---|
| API client & types | `shared/` package | — |
| Auth tokens & session | Same JWT from FastAPI | Native OAuth SDKs (Apple, Google) |
| Cook Mode logic | Step navigation, timers | Swipe gestures, haptics, keep screen on |
| Recipe upload | Paste text | Camera + photo library for images |
| Social link import | Paste URL | Share sheet / clipboard (OS-level) |
| UI components | Design tokens, colors | Separate web (Tailwind) vs mobile (RN StyleSheet / NativeWind) |

**Mobile-first Cook Mode enhancements:**

- **Keep screen awake** during cooking (`expo-keep-awake`)
- **Haptic feedback** on step advance
- **Voice "next step"** — native speech recognition (better than web)
- **Full-screen immersive** mode — no browser chrome
- **Camera upload** — snap a cookbook page or recipe card directly

**App Store / Play Store requirements:**

| Requirement | Notes |
|---|---|
| Apple Developer Program | $99/yr; required for App Store |
| Google Play Console | $25 one-time; required for Play Store |
| Apple Sign In on iOS | **Mandatory** if offering Google login (already in plan) |
| Privacy policy & terms | Required by both stores |
| App icons & screenshots | Per platform/size |
| EAS Submit | Automates upload to App Store Connect / Play Console |

```mermaid
flowchart LR
  subgraph clients [Clients]
    WebApp[WebApp_Vite]
    iOSApp[iOSApp_Expo]
    AndroidApp[AndroidApp_Expo]
  end
  subgraph shared [SharedPackage]
    Types[APITypes]
    Client[APIClient]
  end
  subgraph server [Backend]
    FastAPI[FastAPI]
    DB[(PostgreSQL)]
  end
  WebApp --> shared
  iOSApp --> shared
  AndroidApp --> shared
  shared --> FastAPI
  FastAPI --> DB
```

### 6. Subscriptions & Usage Limits (Phase 5+)

Freemium model introduced at production launch (Phase 5). Phases 1–4 remain unlimited for development.

#### Plans

| Feature | Free | Pro (monthly subscription) |
|---|---|---|
| **AI uploads** | **1 total** (welcome credit on signup) | Unlimited |
| **Manual uploads** | Unlimited | Unlimited |
| **View shared recipes** (`/r/{slug}`) | **5 per calendar month** | Unlimited |
| Own saved recipes & cook mode | Unlimited | Unlimited |
| Collections & meal planner | Unlimited | Unlimited |

#### AI upload vs manual upload

| Type | What it is | Counts against quota? |
|---|---|---|
| **AI upload** | Paste text, PDF/image, or social link → ingestion → **AI parses into steps** | Yes — uses 1 of free credit, then requires Pro |
| **Manual upload** | User enters title, ingredients, and steps by hand — **no AI** | No — always free and unlimited |

When a free user exhausts their AI credit, show an upgrade prompt but still offer **"Add manually"** as an alternative.

#### Share view limit

- Counts only when a **logged-in or anonymous user opens someone else's** shared recipe at `/r/{slug}`
- Does **not** count views of your own recipes or recipes already saved to your library
- Resets on the 1st of each calendar month (UTC)
- At limit: show paywall with upgrade CTA; recipe preview may show title/thumbnail only

```mermaid
flowchart TD
  Request[UploadOrShareViewRequest] --> IsAI{AI_upload?}
  IsAI -->|yes| CheckAI[CheckAIQuota]
  IsAI -->|no manual| Allow[Allow]
  CheckAI --> HasPro{Pro_subscriber?}
  HasPro -->|yes| Allow
  HasPro -->|no| HasCredit{Free_credit_remaining?}
  HasCredit -->|yes| AllowAndDecrement[Allow_and_decrement]
  HasCredit -->|no| Paywall[Show_upgrade_prompt]
  ShareView[ViewSharedRecipe] --> CheckShare[Check_share_views_this_month]
  CheckShare --> ProOrUnder5{Pro_or_under_5?}
  ProOrUnder5 -->|yes| Allow
  ProOrUnder5 -->|no| SharePaywall[Show_upgrade_prompt]
```

#### Billing integration (Phase 5+)

| Platform | Payment provider |
|---|---|
| Web | **Stripe** Checkout + Customer Portal (manage/cancel subscription) |
| iOS app | **Apple In-App Purchase** (required by App Store for in-app subscriptions) |
| Android app | **Google Play Billing** |

Backend maintains a single `subscription_status` regardless of which platform the user subscribed through. Use **RevenueCat** (recommended) or direct store webhooks to unify Apple/Google/Stripe entitlements.

**New database tables:**

```
subscriptions
  user_id, plan ("free" | "pro"), status ("active" | "canceled" | "past_due")
  provider ("stripe" | "apple" | "google"), external_subscription_id
  current_period_start, current_period_end

usage_records
  user_id, usage_type ("ai_upload" | "share_view")
  recorded_at, metadata (recipe_id, slug, etc.)

users (add columns)
  ai_uploads_used       # free-tier lifetime counter (max 1)
  share_views_this_month, share_views_period_start
```

**New API endpoints:**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/billing/plans` | List plans and current user usage |
| GET | `/billing/usage` | AI credit remaining, share views this month |
| POST | `/billing/checkout` | Stripe Checkout session (web) |
| POST | `/billing/webhook` | Stripe / RevenueCat / store webhooks |
| POST | `/billing/portal` | Stripe Customer Portal link |

**Enforcement points:**

- `POST /recipes/parse` and `POST /ingest/*` (when AI parse follows) → check AI quota
- `GET /r/{slug}` → increment share view counter for non-Pro users
- `POST /recipes` with `manual: true` → no quota check

---

```
YourCookMate/
├── web/                      # React (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── api/
│   └── package.json
├── mobile/                   # Expo (React Native) — iOS + Android
│   ├── app/                  # Expo Router screens
│   ├── components/
│   ├── hooks/
│   └── app.json
├── shared/                   # Shared TS: API types, client, constants
│   └── package.json
├── backend/                  # FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/          # auth, recipes, ingest, collections, meal_plans
│   │   ├── services/         # ai_parser, ingest (ocr, pdf, social), recipe_service
│   │   ├── models/           # SQLAlchemy models
│   │   └── schemas/          # Pydantic request/response
│   ├── alembic/              # DB migrations
│   └── requirements.txt
├── docker-compose.yml        # Postgres + backend + frontend dev
├── REFERENCE.md              # This file
└── README.md
```

---

## Recipe Ingestion Pipeline

All input types converge on a `NormalizedRecipe` before AI parsing:

```python
class NormalizedRecipe:
    raw_text: str           # unified text for AI parser
    source_type: str        # "text" | "pdf" | "image" | "instagram" | "tiktok"
    source_url: str | None  # original social link
    file_url: str | None    # stored PDF/image in object storage
    confidence: float       # extraction quality score (0–1)
    extraction_notes: list  # e.g. "OCR low confidence on page 2"
```

### Text paste (Phase 1)

- No preprocessing beyond trim/cleanup
- Fastest path to validate core loop

### PDF upload (Phase 1b)

- **Text-based PDFs:** `pypdf` or `pdfplumber`
- **Scanned PDFs:** render pages to images → OCR
- Store original in MinIO (local, Phases 1–4)

### Image upload (Phase 1b)

- **Primary:** vision model (GPT-4o / Claude vision) — handles handwriting, cookbook photos
- **Fallback:** Tesseract OCR
- Accept: jpg, png, webp, heic (convert server-side)

### Social links — Instagram / TikTok (Phase 1b)

Recipes often live in captions, on-screen text, and spoken audio.

**Pipeline:**

1. Validate URL (`instagram.com/reel/…`, `tiktok.com/@…/video/…`)
2. Fetch metadata via Apify (recommended) or `yt-dlp`
3. Extract from caption, Whisper audio transcript, vision on key frames
4. Merge into `raw_text`
5. Show extraction preview — user confirms before AI parse

**Constraints:**

- Platforms block scraping — always offer manual caption paste fallback
- Respect ToS; do not redistribute downloaded videos
- Store extracted text + thumbnail only, not full video files

```mermaid
flowchart TD
  SocialURL[SocialMediaURL] --> Validate[ValidateURL]
  Validate --> FetchMeta[FetchCaptionAndMetadata]
  FetchMeta --> HasCaption{CaptionHasRecipe?}
  HasCaption -->|yes| Merge[MergeExtractedText]
  HasCaption -->|no| Transcribe[WhisperAudioTranscript]
  Transcribe --> Vision[VisionOnKeyFrames]
  Vision --> Merge
  Merge --> Normalize[NormalizedRecipeText]
  Normalize --> AIParser[AIRecipeParser]
```

---

## AI Recipe Parser

Use **structured output** (`response_format: json_schema` or equivalent).

### Output schema

```json
{
  "title": "Chicken Stir Fry",
  "servings": 4,
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "ingredients": [
    { "name": "chicken breast", "quantity": "1 lb", "group": "Protein" }
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "Cut chicken into bite-sized pieces.",
      "duration_minutes": 5,
      "ingredients_used": ["chicken breast"],
      "equipment": ["cutting board", "knife"]
    }
  ]
}
```

### Prompt rules (step-by-step cards)

- Break compound instructions into single actions
- Move prep notes inline ("while oil heats, dice onion")
- Normalize measurements; flag ambiguous quantities for user review
- Never skip implicit steps (preheat oven, rest meat)
- Cap step length at ~2 sentences

### Resilience

If AI fails or returns low-confidence parse, show raw text side-by-side and let user manually split/merge steps before cooking.

---

## Database Schema (PostgreSQL)

```mermaid
erDiagram
  users ||--o{ oauth_accounts : has
  users ||--o| subscriptions : has
  users ||--o{ usage_records : tracks
  users ||--o{ recipes : owns
  users ||--o{ collections : creates
  users ||--o{ meal_plans : plans
  recipes ||--o{ recipe_ingredients : has
  recipes ||--o{ recipe_steps : has
  collections ||--o{ collection_recipes : contains
  recipes ||--o{ collection_recipes : in
  meal_plans ||--o{ meal_plan_entries : has
  recipes ||--o{ meal_plan_entries : scheduled

  users {
    uuid id PK
    string email
    string password_hash
    string display_name
    string avatar_url
    int ai_uploads_used
    int share_views_this_month
    date share_views_period_start
    datetime created_at
  }
  subscriptions {
    uuid id PK
    uuid user_id FK
    string plan
    string status
    string provider
    string external_subscription_id
    datetime current_period_start
    datetime current_period_end
  }
  usage_records {
    uuid id PK
    uuid user_id FK
    string usage_type
    datetime recorded_at
    jsonb metadata
  }
  recipes {
    uuid id PK
    uuid user_id FK
    string title
    text raw_text
    string source_type
    boolean is_manual
    string source_url
    string file_url
    jsonb parsed_json
    jsonb extraction_metadata
    boolean is_public
    string share_slug
  }
  oauth_accounts {
    uuid id PK
    uuid user_id FK
    string provider
    string provider_subject
    datetime linked_at
  }
  recipe_steps {
    uuid id PK
    uuid recipe_id FK
    int step_order
    text instruction
    int duration_minutes
    jsonb ingredients_used
  }
  collections {
    uuid id PK
    uuid user_id FK
    string name
  }
  meal_plans {
    uuid id PK
    uuid user_id FK
    date week_start
  }
  meal_plan_entries {
    uuid id PK
    uuid meal_plan_id FK
    uuid recipe_id FK
    date meal_date
    string meal_type
  }
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Email sign-up → JWT |
| POST | `/auth/login` | Email login → JWT |
| POST | `/auth/google` | Verify Google ID token → JWT |
| POST | `/auth/apple` | Verify Apple identity token → JWT |
| POST | `/auth/refresh` | Refresh expired JWT |
| POST | `/auth/logout` | Invalidate refresh token (optional) |
| POST | `/ingest/text` | Paste text → normalized recipe text |
| POST | `/ingest/file` | Upload PDF/image → extract text (multipart) |
| POST | `/ingest/link` | Instagram/TikTok URL → extract caption + transcript |
| POST | `/recipes/parse` | Normalized text → AI structured recipe (preview) |
| POST | `/recipes` | Save parsed recipe |
| GET | `/recipes` | User library (paginated, searchable) |
| GET | `/recipes/{id}` | Full recipe detail |
| GET | `/recipes/{id}/cook` | Steps optimized for cook mode |
| PATCH | `/recipes/{id}` | Edit title/steps after parse |
| DELETE | `/recipes/{id}` | Remove from library |
| POST | `/recipes/{id}/share` | Generate public slug |
| GET | `/r/{slug}` | Public shared recipe |
| CRUD | `/collections`, `/collections/{id}/recipes` | Recipe folders |
| CRUD | `/meal-plans`, `/meal-plans/{id}/entries` | Weekly planner |
| GET | `/billing/plans` | Plans + current usage (Phase 5+) |
| GET | `/billing/usage` | AI credit remaining, share views this month |
| POST | `/billing/checkout` | Stripe Checkout session (web) |
| POST | `/billing/webhook` | Stripe / RevenueCat / store webhooks |
| POST | `/billing/portal` | Stripe Customer Portal (manage subscription) |
| POST | `/recipes/manual` | Manual recipe entry — no AI, no quota (Phase 5+) |

---

## Frontend Pages

| Page | Route | Notes |
|---|---|---|
| Landing | `/` | Value prop + "Add a recipe" CTA |
| Upload | `/new` | Tabbed: Paste / Upload file / Paste link / **Add manually** |
| Upgrade | `/upgrade` | Plan comparison, usage stats, subscribe CTA (Phase 5+) |
| Review | `/new/review` | Edit parsed result before saving |
| Cook Mode | `/cook/{id}` | Full-screen step carousel (hero UX) |
| Library | `/recipes` | Grid of saved recipes, search/filter |
| Recipe Detail | `/recipes/{id}` | Ingredients + "Start Cooking" |
| Collections | `/collections` | Folder management |
| Meal Planner | `/plan` | Week view, drag-drop recipes |
| Shared Recipe | `/r/{slug}` | Public view, save-to-library CTA |
| Auth | `/login`, `/register` | Email + Google + Apple sign-in |

### Cook Mode components

| Component | Responsibility |
|---|---|
| `CookModeShell` | Layout, progress bar, exit button |
| `StepCard` | Current instruction, timer, equipment icons |
| `IngredientDrawer` | Slide-up panel for step-relevant ingredients |
| `StepNavigator` | Prev/next, keyboard + swipe handlers |

---

## Phased Delivery

> **Infrastructure rule:** Phases 1–4 run entirely on your machine via Docker Compose. No AWS required until Phase 5, when the backend and web app move to AWS for production (required for App Store / Play Store launch).

### Phase 1 — Core Loop (1–2 weeks)

- FastAPI + Postgres + Docker Compose scaffold (**local only**)
- React (Vite + TS) scaffold — `localhost` dev server
- Text paste + `POST /recipes/parse` with AI
- Review → Cook Mode (localStorage, no auth)
- **Goal:** Paste a recipe and flip through steps on your phone

### Phase 1b — Multi-Source Ingestion (1–2 weeks)

- Tabbed upload UI (Paste / File / Link)
- PDF extraction + image vision/OCR
- Object storage via **MinIO** in Docker Compose (local only)
- Social link resolver + Whisper transcription
- Extraction preview before AI parse
- **Goal:** Photo, PDF, or reel link → same cook mode experience

### Phase 2 — Accounts & Library (1–2 weeks)

- Email register/login with JWT
- Google OAuth (Google Identity Services on frontend, token verification on backend)
- Sign in with Apple (Apple JS SDK on web; required for iOS users later)
- `users` + `oauth_accounts` tables
- Save/load recipes from DB
- My Recipes page with search
- **Goal:** Sign up via email, Google, or Apple; return and cook saved recipes

### Phase 3 — Share & Collections (1 week)

- Public share links
- Collections CRUD
- **Goal:** Share with friends; organize favorites

### Phase 4 — Meal Planning (1 week)

- Weekly calendar UI
- Assign recipes to days/meals
- Launch cook mode from planner
- **Goal:** Plan the week, cook from the plan

### Phase 5 — Mobile Apps + AWS Production (2–3 weeks)

**5a — AWS migration (start of Phase 5):**

- Deploy FastAPI to **AWS App Runner** or **ECS Fargate**
- Database: **RDS PostgreSQL** (migrate from local Docker Postgres)
- File storage: **S3** (replace MinIO; use storage abstraction layer built in Phases 1–4)
- Web app: **S3 + CloudFront** static hosting (or Amplify Hosting)
- Secrets: **AWS Secrets Manager** for API keys, JWT secret, OAuth credentials
- HTTPS: **ACM** certificate + custom domain via Route 53 (optional)
- CI/CD: GitHub Actions → deploy backend + web on merge to `main`

**5b — Mobile apps:**

- Expo project scaffold in `mobile/`; shared `shared/` package for API types/client
- Mobile + web point at **AWS API URL** (not localhost)
- Port core flows: auth (email, Google, Apple), upload, review, cook mode, library
- Native features: camera/photo upload, keep-awake in cook mode, haptics
- EAS Build configured for iOS and Android
- App Store Connect + Google Play Console setup
- Privacy policy, app icons, store listing copy
- Submit to Apple App Store and Google Play Store
- **Goal:** Production AWS backend + live native apps on both stores

**5c — Subscriptions & usage limits:**

- Free tier: 1 AI upload on signup, unlimited manual entry, 5 shared-recipe views/month
- Pro tier: monthly subscription — unlimited AI uploads and share views
- Stripe (web) + Apple IAP + Google Play Billing via RevenueCat
- Quota enforcement on `POST /recipes/parse`, `POST /ingest/*`, and `GET /r/{slug}`
- Upgrade/paywall UI on web and mobile
- **Goal:** Monetization live before or at store launch

**Build order:** Ship and validate on **local web** (Phases 1–4, no paywall), then **AWS + mobile + billing** in Phase 5.

---

## Infrastructure & Deployment

### Phases 1–4 — Local development only

Everything runs on your machine. No AWS account needed.

```mermaid
flowchart LR
  subgraph local [LocalMachine_DockerCompose]
    WebDev[ViteDevServer_localhost5173]
    FastAPI[FastAPI_localhost8000]
    Postgres[(PostgreSQL)]
    MinIO[(MinIO)]
  end
  subgraph external [ExternalAPIs]
    OpenAI[OpenAI_or_Anthropic]
    GoogleOAuth[GoogleOAuth]
    AppleOAuth[AppleOAuth]
  end
  WebDev --> FastAPI
  FastAPI --> Postgres
  FastAPI --> MinIO
  FastAPI --> OpenAI
  WebDev --> GoogleOAuth
  WebDev --> AppleOAuth
```

| Service | Local setup (Phases 1–4) |
|---|---|
| Backend | FastAPI in Docker Compose → `http://localhost:8000` |
| Database | PostgreSQL in Docker Compose |
| File storage | MinIO in Docker Compose (S3-compatible API) |
| Web app | Vite dev server → `http://localhost:5173` |
| Auth | OAuth redirect URIs pointed at `localhost` |
| AI | OpenAI / Anthropic API (external; requires API key) |

**Local env vars (`.env` file, not committed):**

```
DATABASE_URL=postgresql://user:pass@localhost:5432/yourcookmate
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=recipes
OPENAI_API_KEY=...
JWT_SECRET=local-dev-secret
GOOGLE_CLIENT_ID=...
APPLE_CLIENT_ID=...
```

**Design for AWS migration:** Use a storage abstraction (`StorageBackend` interface) in the backend so swapping MinIO → S3 in Phase 5 is a config change, not a rewrite.

### Phase 5+ — AWS production

Required before App Store / Play Store launch — mobile apps cannot point at `localhost`.

```mermaid
flowchart LR
  subgraph clients [Clients]
    WebApp[WebApp_CloudFront]
    iOSApp[iOSApp]
    AndroidApp[AndroidApp]
  end
  subgraph aws [AWS]
    CloudFront[CloudFront]
    S3Web[S3_WebAssets]
    AppRunner[AppRunner_or_ECS_FastAPI]
    RDS[(RDS_PostgreSQL)]
    S3Files[S3_RecipeFiles]
    Secrets[SecretsManager]
  end
  WebApp --> CloudFront --> S3Web
  iOSApp --> AppRunner
  AndroidApp --> AppRunner
  AppRunner --> RDS
  AppRunner --> S3Files
  AppRunner --> Secrets
```

| Service | AWS service (Phase 5+) |
|---|---|
| Backend API | **App Runner** (simplest) or **ECS Fargate** (more control) |
| Database | **RDS PostgreSQL** |
| File storage | **S3** |
| Web hosting | **S3 + CloudFront** or **Amplify Hosting** |
| Secrets | **AWS Secrets Manager** |
| DNS / HTTPS | **Route 53** + **ACM** (when custom domain ready) |
| Mobile builds | **Expo EAS** (external; publishes to App Store / Play Store) |
| CI/CD | **GitHub Actions** → deploy on merge |

**AWS env vars (Phase 5+, via Secrets Manager or task env):**

```
DATABASE_URL=postgresql://...@yourcookmate.xxxx.rds.amazonaws.com/yourcookmate
S3_BUCKET=yourcookmate-recipes
AWS_REGION=us-east-1
OPENAI_API_KEY=...          # from Secrets Manager
JWT_SECRET=...              # from Secrets Manager
GOOGLE_CLIENT_ID=...
APPLE_CLIENT_ID=...
```

**Estimated AWS cost (early stage):** ~$30–80/mo (RDS db.t4g.micro, App Runner, S3, CloudFront at low traffic).

---

## Dependencies

### Backend

```
fastapi
uvicorn
sqlalchemy
alembic
psycopg2-binary
python-jose          # JWT
passlib              # password hashing (email auth)
google-auth          # verify Google ID tokens
PyJWT[crypto]        # verify Apple identity tokens (JWKS)
authlib              # optional OAuth helpers
openai / anthropic   # AI parser + vision
pypdf / pdfplumber   # PDF text extraction
pytesseract + Pillow # OCR fallback
openai-whisper       # reel audio transcription
yt-dlp               # social link metadata (use carefully)
boto3 / minio        # minio (Phases 1–4 local); boto3 (Phase 5+ AWS S3)
pydantic-settings
stripe                 # Phase 5+ web billing
```

### Web (`web/package.json`)

```
react
react-router-dom
typescript
vite
@tanstack/react-query
framer-motion
tailwindcss
axios
@react-oauth/google      # Google sign-in (web)
@stripe/stripe-js        # Stripe Checkout (Phase 5+)
```

### Mobile (`mobile/package.json`)

```
expo
expo-router
react-native
@react-native-google-signin/google-signin
expo-apple-authentication
react-native-purchases   # RevenueCat — Apple/Google IAP (Phase 5+)
expo-image-picker        # camera + photo library
expo-keep-awake          # screen on during cook mode
expo-haptics
@tanstack/react-query
```

### Infrastructure

| Phase | Where | Services |
|---|---|---|
| **1–4** | Local (Docker Compose) | PostgreSQL, MinIO, FastAPI, Vite dev server |
| **5+** | AWS | RDS, S3, App Runner/ECS, CloudFront, Secrets Manager |

External (all phases): OpenAI/Anthropic API, Expo EAS (Phase 5 mobile builds).

### Environment variables

**Phases 1–4 (local `.env`):**

```
DATABASE_URL
MINIO_ENDPOINT
MINIO_ACCESS_KEY
MINIO_SECRET_KEY
MINIO_BUCKET
OPENAI_API_KEY
JWT_SECRET
GOOGLE_CLIENT_ID
APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APIFY_API_KEY          # optional
```

**Phase 5+ (AWS Secrets Manager / task env):**

```
DATABASE_URL           # RDS connection string
S3_BUCKET
AWS_REGION
OPENAI_API_KEY
JWT_SECRET
JWT_REFRESH_SECRET
GOOGLE_CLIENT_ID
APPLE_CLIENT_ID
APPLE_TEAM_ID
APPLE_KEY_ID
APPLE_PRIVATE_KEY
APIFY_API_KEY
STRIPE_SECRET_KEY        # Phase 5+
STRIPE_WEBHOOK_SECRET
REVENUECAT_API_KEY       # Phase 5+ mobile IAP
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI parses poorly | Review screen; step edit/split/merge |
| Long AI latency (5–15s) | Streaming status UI with stage labels |
| Varied recipe formats | Few-shot prompts; always store raw text |
| Messy hands in kitchen | Large tap targets; voice "next" in Phase 2 |
| OCR/vision fails | Show extracted text for edit; allow re-upload |
| Social scrapers break | Apify fallback; manual caption paste |
| Audio-only reel recipes | Whisper + transcript confirmation screen |
| Low-quality scanned PDFs | Page-by-page OCR with confidence flags |
| Duplicate accounts (email vs OAuth) | Match on verified email; merge or prompt to link |
| Apple Sign In on web | Requires Apple Developer account + domain verification |
| App Store review delays | Submit early; follow Apple HIG; avoid broken OAuth flows |
| Maintaining web + mobile | Shared `shared/` package; single FastAPI backend; feature parity checklist |
| Local-to-AWS migration | Storage abstraction layer; Alembic migrations; Phase 5 deploy checklist |
| AWS costs at launch | Start with App Runner + db.t4g.micro RDS; scale as traffic grows |
| App Store IAP rules | iOS subscriptions must use Apple IAP; use RevenueCat to unify with Stripe |
| Users hit AI limit | Always offer manual upload path; clear upgrade CTA with value prop |
| Share view tracking for anonymous users | Track by session cookie + IP fingerprint; merge on signup |

---

## Out of Scope (V1 web — included in Phase 5 mobile)

- Generic blog URL import (AllRecipes, NYT Cooking, etc.)
- YouTube / Pinterest / Facebook links
- Grocery list generation
- Nutrition calculation
- Push notifications for meal reminders (post-launch mobile)
- Multi-user collaborative meal plans
- iOS Share Extension / Android share target for reel links (post-launch)

---

## Success Criteria

- [ ] Add recipe via text, PDF, photo, or Instagram/TikTok link → 8–15 clear atomic steps
- [ ] Social link shows extracted caption/transcript for confirmation before parsing
- [ ] Photo/PDF upload handles cookbook page with reasonable accuracy
- [ ] Cook Mode feels natural on a phone at arm's length in a kitchen
- [ ] Saved recipes persist across sessions
- [ ] Shared link works without login
- [ ] Meal planner schedules 5+ recipes and launches cook mode in one tap
- [ ] iOS app live on Apple App Store
- [ ] Android app live on Google Play Store
- [ ] Mobile cook mode: keep-awake, swipe navigation, camera upload
- [ ] Free user: 1 AI upload, unlimited manual entry, 5 share views/month enforced
- [ ] Pro subscriber: unlimited AI uploads and share views via Stripe / IAP
