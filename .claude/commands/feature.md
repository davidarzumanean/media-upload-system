# Feature Command

Use this command to implement a new feature or visible behavior change.

## Process

1. Read root `CLAUDE.md`.
2. Identify affected packages before editing.
3. Read only the relevant package `CLAUDE.md` files.
4. Inspect only files necessary for the task.
5. Write a short implementation plan before changing code.
6. Implement the smallest useful change.
7. Run narrow validation for touched packages.
8. Summarize changed files, validation result, and risks.

## Boundary Rules

- Do not spread a feature across packages unless required by existing boundaries.
- Shared upload behavior belongs in `packages/upload-core`.
- Web-only UX belongs in `apps/web`.
- Mobile-only UX belongs in `apps/mobile`.
- Backend contract, storage, upload assembly, MIME validation, deduplication, and cleanup belong in `apps/api`.
- Do not duplicate shared logic between web and mobile.
- Do not add any dependency from `apps/api` to `packages/upload-core`.
- Do not move platform-specific code into `packages/upload-core`.

## API Contract Rules

- Check the cancel-route mismatch before touching cancel flows:
    - clients use `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`
- If changing API behavior, update affected clients or preserve backward compatibility.

## Validation

- Core:
    - `pnpm --filter @media-upload/core build`
    - `pnpm --filter @media-upload/core test`
- Web:
    - `pnpm --filter web build`
- Mobile:
    - run the smallest available validation command from `apps/mobile/package.json` or typecheck if available
- API:
    - validate route/controller/service consistency
    - verify affected clients still match the API contract

## Output

After implementation, report:

- affected packages
- changed files
- validation commands run
- any skipped validation and why
- risks or follow-up work