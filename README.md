# FileStream — Cross-Platform Media Upload System

A chunked media upload solution supporting web and mobile platforms, with robust file handling, pause/resume/cancel controls, and automatic retry.

## Monorepo Structure

```
media-upload-system/
├── apps/
│   ├── web/            # React + Vite + TypeScript
│   ├── mobile/         # React Native + Expo
│   └── api/            # Symfony 6.4 + SQLite (Docker)
├── packages/
│   └── upload-core/    # Shared upload engine (pure TypeScript)
└── docs/
    ├── architecture.md
    ├── api.md
    └── tradeoffs.md
```

## Quick Start

### Prerequisites

- Node.js ≥ 18
- pnpm ≥ 9 (`corepack enable && corepack prepare pnpm@latest --activate`)
- Docker & Docker Compose

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the API (Symfony + SQLite via Docker)

```bash
docker compose up
```

The API runs at `http://localhost:8000`.

### 3. Start the web app

```bash
cd apps/web
npm run dev
```

Opens at `http://localhost:5173`.

### 4. Start the mobile app

```bash
cd apps/mobile
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `i` for iOS simulator (requires Xcode).

**Note:** The mobile app requires a native environment (Expo Go or simulator). It does not run in web mode due to native dependencies (`expo-file-system`, `expo-image-picker`).

For physical device testing, update `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<YOUR_MAC_IP>:8000/api
```

## Running Tests

```bash
# Shared upload engine (vitest)
cd packages/upload-core && pnpm test

# Web app (vitest + testing-library)
cd apps/web && pnpm test

# Mobile app (jest + testing-library)
cd apps/mobile && pnpm test

# Backend (PHPUnit via Docker)
docker compose run --rm api php bin/phpunit
```

## Key Features

### Upload Engine (`packages/upload-core`)

- Class-based `UploadManager` — framework-agnostic, event-driven orchestrator
- Chunked upload with configurable 1 MB chunks
- Global concurrency control (max 3 parallel uploads across all files)
- Pause/resume/cancel per file with proper HTTP request abortion via AbortSignal
- Exponential backoff retry (max 3 retries, base 1s, capped at 30s)
- Platform adapter pattern — web and mobile provide their own `ChunkReader` and `ApiClient` implementations
- File validation (type, size, quantity) before upload

### Web App (`apps/web`)

- Drag-and-drop upload with react-dropzone
- Real-time progress bars with smooth CSS transitions
- Inline pause/resume/cancel controls per file
- Upload history persisted in localStorage with server-side thumbnails
- Tab-based routing (Upload / History)
- Responsive layout (desktop/tablet)

### Mobile App (`apps/mobile`)

- Native gallery picker with multi-select (expo-image-picker)
- Direct camera capture
- Permission management for camera/gallery
- Floating bottom tab navigation
- Same upload engine as web via shared `@media-upload/core`

### API (`apps/api`)

- RESTful chunked upload endpoints (initiate → chunks → finalize)
- Magic number file type validation (php finfo)
- MD5 checksum deduplication
- Organized file storage by date
- Automatic cleanup commands for stale chunks (30 min) and expired files (30 days)
- File serving endpoint for history thumbnails

## Cleanup Commands

```bash
# Remove stale incomplete uploads (>30 minutes old)
docker compose run --rm api php bin/console app:cleanup:chunks

# Remove completed uploads older than 30 days
docker compose run --rm api php bin/console app:cleanup:expired
```

In production, schedule these via cron:

```
*/5 * * * * php bin/console app:cleanup:chunks
0 3 * * *   php bin/console app:cleanup:expired
```

## Documentation

- [Architecture](docs/architecture.md) — system design, upload flow, key decisions
- [API Reference](docs/api.md) — endpoint documentation
- [Tradeoffs](docs/tradeoffs.md) — design decisions and future improvements
