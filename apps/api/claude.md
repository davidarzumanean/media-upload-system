# apps/api Rules

- This app must not depend on `packages/upload-core`.
- Keep all server behavior local to Symfony services/controllers/commands.
- Server-side upload persistence, chunk storage, file assembly, MIME validation, deduplication, and cleanup belong here.
- Do not import client-side concepts, React code, or shared frontend abstractions here.

## Contract Rules

- Preserve HTTP compatibility unless intentionally changing clients too.
- Cancel route is `DELETE /{uploadId}`. If changing it, update both clients too.

## Change Rules

- Keep route/controller changes aligned with `apps/web` and `apps/mobile` clients.
- Keep persistence and filesystem behavior inside `UploadService`-style backend code.

## Validation

- Validate route/controller/service consistency.
- If API routes change, verify both clients still match the contract.
