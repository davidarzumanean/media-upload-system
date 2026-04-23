# Architecture

## Monorepo Structure
media-upload-system/
├── apps/
│   ├── web/            # React + Vite + TypeScript
│   ├── mobile/         # React Native + Expo
│   └── api/            # Symfony 6.4 + SQLite (Docker)
├── packages/
│   └── upload-core/    # Shared upload engine (pure TypeScript)
└── docs/

## Key Decisions

- **Monorepo with pnpm workspaces** — shared upload logic, independent UIs
- **upload-core is framework-agnostic** — class-based UploadManager, no React dependency
- **Platform adapters** — web and mobile each provide their own file-reading strategy
- **SQLite + local filesystem** — no external DB dependency for the assignment
- **Docker for API** — no local PHP required

## Upload Flow

1. Client validates and selects files (1-10)
2. Client calls `POST /api/uploads/initiate` per file
3. Client chunks files into 1MB pieces
4. Central scheduler dispatches chunks (max 3 concurrent)
5. On all chunks received, client calls `POST /api/uploads/{id}/finalize`
6. Server reassembles, validates (magic number), deduplicates (MD5)