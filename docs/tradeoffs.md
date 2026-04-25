# Tradeoffs & Future Improvements

## Decisions Made

### Class-based UploadManager vs Hooks/Reducers

**Chose:** Class-based orchestrator with `onChange` callback.

**Why:** The upload lifecycle involves async operations, AbortControllers, retry timers, and a concurrent task queue. This is imperative, stateful logic that fits naturally in a class. A reducer would require complex action types for every state transition, and hooks would tie the logic to React. The class is testable in isolation, works identically across web and mobile, and the React integration is a single `setState(snapshot)` call.

### SQLite vs PostgreSQL

**Chose:** SQLite via Doctrine DBAL.

**Why:** Eliminates external database dependencies. One Docker container runs the entire API. For this assignment's scope (single user, no concurrent writes), SQLite is sufficient. In production, PostgreSQL would be necessary for concurrent access and proper transactions.

### Local Filesystem vs Cloud Storage (S3)

**Chose:** Local filesystem with organized directory structure.

**Why:** Simplifies the assignment setup — no AWS credentials or external services required. The storage layer is isolated in `UploadService`, so switching to S3 would only require changing the file write/read methods, not the API or client logic.

### Doctrine DBAL vs Doctrine ORM

**Chose:** Raw DBAL queries instead of ORM entities.

**Why:** For 5 queries against a single table, the ORM's entity mapping, repository pattern, and migration system would be overhead. DBAL gives us typed SQL with parameter binding, which is sufficient and keeps the codebase small.

### Auto-upload on Drop vs Manual Start

**Chose:** Uploads start immediately when files are dropped/selected.

**Why:** Reduces friction — adding a file is the intent to upload. Most production upload UIs (Google Drive, WeTransfer, Slack) start immediately. The "Upload All" button was removed as unnecessary.

### Global Concurrency vs Per-File Concurrency

**Chose:** Max 3 concurrent chunk uploads globally (across all files).

**Why:** Simpler to reason about, prevents server overload regardless of how many files are queued. Per-file concurrency would require more complex scheduling and could overwhelm the server with many simultaneous files.

### Platform-Adapted UI vs Identical UI

**Chose:** Different interaction patterns where appropriate (web: icon buttons for pause/cancel, mobile: text buttons).

**Why:** Mobile touch targets need to be larger and more readable. Web can afford compact icon buttons because hover states provide affordance. The visual language (colors, badges, progress bars, card styles) is consistent via shared design tokens.

## Known Limitations

### No Redis-Based Resumable Uploads

Current implementation tracks chunks via filesystem (checking which `.part` files exist). In production, Redis would provide faster chunk status lookups and support distributed servers. The upload state would survive server restarts.

### No Background Upload on Mobile

React Native's fetch runs in the JS thread. On iOS, the app suspending kills active uploads. Production implementation would use `expo-background-fetch` or `react-native-background-upload` for true background uploads.

### No Upload Rate Limiting

The API doesn't enforce per-client rate limits. In production, add Symfony's RateLimiter component or nginx-level rate limiting (e.g., 10 requests/minute per IP).

### No Malicious File Detection

File validation is limited to magic number checking (finfo). Production systems should integrate with ClamAV or a sandboxing service for malware detection.

### No Image Optimization

Uploaded images are stored at original size. Production would generate thumbnails (e.g., 200x200 for previews), convert to WebP for serving, and strip EXIF metadata for privacy.

### No Monitoring Dashboard

The assignment mentions real-time monitoring (upload success rate, active uploads, system load). This was deferred as an advanced requirement. In production, integrate with Prometheus/Grafana or a logging platform like Datadog.

### No Stress Testing

The assignment mentions 100 concurrent uploads. While the architecture supports it (chunked uploads, queue-based scheduling), formal load testing with tools like k6 or Artillery was not implemented.

### CORS Configuration

Currently allows all origins (`*`). Production should restrict to specific frontend domains.

### Web/Mobile Color Alignment

Shared design tokens exist in `@media-upload/core/theme.ts`, but the web app's Tailwind classes don't fully reference them yet. Some colors are hardcoded in Tailwind utilities. A full alignment would map theme tokens to Tailwind's config.

## What I'd Do With More Time

1. **Redis chunk tracking** — faster status lookups, distributed server support
2. **Image optimization pipeline** — thumbnail generation, WebP conversion, EXIF stripping
3. **WebSocket progress** — server-push progress updates instead of client-side calculation
4. **E2E tests** — Playwright for web, Detox for mobile, covering the full upload flow
5. **Background upload on mobile** — using native upload APIs that survive app suspension
6. **Rate limiting** — per-IP and per-user upload throttling
7. **Presigned URLs** — direct-to-S3 uploads bypassing the API server for large files
8. **Upload queuing** — server-side queue (RabbitMQ/Redis) for file processing (virus scan, thumbnail generation) after upload