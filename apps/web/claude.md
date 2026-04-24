# apps/web Rules

- Keep changes web-specific.
- Do not duplicate shared upload logic that belongs in `packages/upload-core`.
- Browser-only concerns stay here:
    - drag/drop
    - file input handling
    - object URLs / previews
    - browser routing
    - localStorage history
    - fetch-based API client
- Do not redesign `UploadManager` from the web app.

## Integration Rules

- Use `@media-upload/core` for upload state, actions, types, validation, and shared formatting/tokens.
- Keep the web hook/provider as the adapter layer around the shared manager.
- If a behavior change is needed by both web and mobile, move it to `upload-core` instead of reimplementing it here.

## API Contract Warning

- Known mismatch:
    - client uses `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`
- Do not change cancel UX without checking backend compatibility.

## Validation

- Run: `pnpm --filter web build`
- If shared behavior was touched, also run core build/tests.
