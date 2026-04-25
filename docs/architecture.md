# Architecture

## Overview

FileStream is a cross-platform chunked media upload system. The core upload logic lives in a shared TypeScript package (`upload-core`) consumed by both a React web app and a React Native mobile app. The backend is a Symfony 6.4 API using SQLite for metadata and local filesystem for file storage, running in Docker.

## Monorepo Structure

```
media-upload-system/
├── apps/
│   ├── web/            # React 19 + Vite + TypeScript + Tailwind
│   ├── mobile/         # React Native + Expo SDK 54
│   └── api/            # Symfony 6.4 + SQLite (Dockerized)
├── packages/
│   └── upload-core/    # Shared upload engine (pure TypeScript)
└── docs/
```

Managed with pnpm workspaces. Each app references `@media-upload/core` via `"workspace:*"`.

## Upload Flow

```
Client                                     Server
  │                                          │
  │  1. POST /api/uploads/initiate           │
  │  { name, size, mimeType }                │
  │ ──────────────────────────────────────>   │
  │  { uploadId, totalChunks }               │
  │ <──────────────────────────────────────   │
  │                                          │
  │  2. POST /api/uploads/{id}/chunks/{i}    │
  │  [1 MB chunk as multipart/form-data]     │
  │  (max 3 concurrent, across all files)    │
  │ ──────────────────────────────────────>   │
  │  { received: true }                      │
  │ <──────────────────────────────────────   │
  │         ... repeat for each chunk ...    │
  │                                          │
  │  3. POST /api/uploads/{id}/finalize      │
  │ ──────────────────────────────────────>   │
  │  Server: reassemble, validate magic      │
  │  number, compute MD5, dedup, store       │
  │  { status: completed, path, fileId }     │
  │ <──────────────────────────────────────   │
```

## Core Design Decisions

### 1. Shared Upload Engine (packages/upload-core)

The `UploadManager` class is the heart of the system. It's a pure TypeScript class with zero framework dependencies — no React, no Node-specific APIs.

Why a class instead of a hook or reducer: the upload orchestrator manages async operations, AbortControllers, retry timers, and a concurrent task queue. This is imperative, stateful logic that doesn't map well to a reducer's action/state pattern. A class encapsulates it cleanly, is testable without React, and works identically in React Native.

The React integration is minimal: a thin hook subscribes to `onChange` and calls `setState(snapshot)`.

### 2. Platform Adapter Pattern

Two interfaces decouple the engine from platform-specific APIs:

**ChunkReader**: `(file, chunkIndex, chunkSize) => Promise<Blob | ArrayBuffer>`
- Web implementation: `File.slice(start, end)` → returns Blob
- Mobile implementation: `expo-file-system/legacy.readAsStringAsync()` with base64 encoding → converts to ArrayBuffer

**ApiClient**: `{ initiate, uploadChunk, finalize, getStatus, cancel }`
- Both platforms implement this with `fetch()`, but mobile needs special FormData handling (React Native doesn't support Blob from ArrayBuffer)

This means the core engine never imports `fetch`, `File`, or any platform API.

### 3. Global Concurrency Control

The scheduler maintains a queue of `ChunkTask` objects and dispatches up to 3 at a time across ALL files (not per-file). This prevents server overload and simplifies reasoning about system load.

```
                    ┌─────────────┐
  addFiles() ──►   │  TASK QUEUE  │   ChunkTasks waiting
                    └──────┬──────┘
                           │ dispatch (max 3 concurrent)
                    ┌──────▼──────┐
                    │  IN-FLIGHT   │   Active HTTP requests
                    └──────┬──────┘
                      ┌────┴────┐
                   success    error
                      │         │
                mark chunk    retry with backoff
                 uploaded     (max 3 attempts)
                      │
              all chunks done? → finalize
```

### 4. Pause/Resume with AbortSignal

Pause does two things:
1. Removes the file's pending chunks from the queue
2. Aborts in-flight HTTP requests via `AbortController.abort()`

The `AbortSignal` is passed through to `fetch()` in both web and mobile API clients, ensuring requests are actually cancelled at the network level.

If a chunk upload completes despite the abort (race condition), the chunk is still recorded as uploaded — we don't waste successful work. On resume, only missing chunks are re-enqueued. If all chunks completed while paused, resume goes straight to finalize.

### 5. SQLite over PostgreSQL

For this assignment, SQLite eliminates external database dependencies. The API runs with a single Docker container. In production, PostgreSQL or MySQL would replace SQLite for concurrent write support.

### 6. File Storage Strategy

Files are stored in an organized directory structure:

```
var/uploads/
├── tmp/              # Chunks during upload
│   └── {uploadId}/
│       ├── 0.part
│       ├── 1.part
│       └── ...
└── final/            # Completed files
    └── {YYYY/MM/DD}/
        └── {md5}_{sanitized_name}
```

Deduplication: if two files have identical MD5 checksums, the second upload points to the existing file instead of storing a duplicate.

### 7. Shared Design Tokens

Colors are defined in `packages/upload-core/src/theme.ts` and consumed by both web (via Tailwind config) and mobile (via React Native StyleSheet). This ensures visual consistency across platforms from a single source of truth.

## Testing Strategy

Tests are distributed across the codebase targeting different layers:

- **upload-core**: Unit tests for validation, chunking math, and the full UploadManager lifecycle (concurrency, pause/resume, retry, abort, finalize). Uses vitest with mock ApiClient and ChunkReader.
- **web**: Component tests with @testing-library/react for DropZone, FilePreview, UploadHistory. Hook tests for useUploadManager.
- **mobile**: Component and hook tests with @testing-library/react-native. Native modules (expo-image-picker, expo-file-system) are mocked.
- **api**: PHPUnit tests for UploadService (SQLite in-memory) and UploadController (Symfony WebTestCase).