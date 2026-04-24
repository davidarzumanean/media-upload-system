# Monorepo Rules

- Before editing, inspect the relevant package `CLAUDE.md`.
- Only inspect files that are necessary for the current task.
- Avoid loading entire directories or large files unless required.
- Before making changes, identify affected packages and outline a short plan.
- Only edit files directly related to the task.
- Do not modify multiple packages unless the change explicitly requires cross-package updates.
- Keep changes minimal; no opportunistic cleanup.
- Respect package boundaries.
- Put shared upload behavior in `packages/upload-core` only.
- Never duplicate shared logic between `apps/web` and `apps/mobile`.
- Do not move web/mobile-specific UI, storage, routing, or platform file access into `upload-core`.
- Do not add any dependency from `apps/api` to `packages/upload-core`.
- If a change affects both web and mobile upload behavior, update shared logic first and keep app code thin.
- If a change is web-only or mobile-only UX, keep it inside that app.

## Package Boundaries

- `packages/upload-core`: framework-agnostic upload engine, shared types, validation, chunking, formatting, theme tokens.
- `apps/web`: browser UI, browser file handling, web routing, localStorage-backed history, HTTP client.
- `apps/mobile`: Expo/React Native UI, native file picking, AsyncStorage-backed history, HTTP client.
- `apps/api`: Symfony upload API, SQLite/filesystem persistence, assembly, MIME validation, deduplication, cleanup.

## API Contract Warning

- Known mismatch:
  - clients use `DELETE /uploads/{id}`
  - API exposes `POST /{uploadId}/cancel`
- Do not ignore this when touching cancel flows.
- If changing cancel behavior, update clients and API together or preserve compatibility.

## Validation

- Shared core changes:
  - `pnpm --filter @media-upload/core build`
  - `pnpm --filter @media-upload/core test`
- Web changes:
  - `pnpm --filter web build`
- Mobile changes:
  - run the smallest available validation command from `apps/mobile/package.json` or typecheck if available
- API changes:
  - validate controller/service wiring
  - keep routes aligned with clients