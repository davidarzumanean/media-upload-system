# Fix Command

Use this command to fix bugs or incorrect behavior.

## Process

1. Read root `CLAUDE.md`.
2. Identify the smallest affected package.
3. Read only the relevant package `CLAUDE.md`.
4. Inspect only files related to the bug.
5. Reproduce or clearly identify the failure condition.
6. Determine the correct boundary for the fix.
7. Write a short plan before editing.
8. Implement the minimal fix.
9. Run narrow validation.
10. Summarize changes, validation, and risks.

## Boundary Rules

- Fix at the correct boundary:
    - shared upload bug → `packages/upload-core`
    - web-only bug → `apps/web`
    - mobile-only bug → `apps/mobile`
    - backend/API bug → `apps/api`
- Do not patch the same shared behavior separately in web and mobile.
- Do not duplicate logic across apps.
- Do not move API logic into clients.
- Do not add any dependency from `apps/api` to `packages/upload-core`.
- Do not move platform-specific code into `packages/upload-core`.

## API Contract Rules

- If the bug involves cancel/retry/status flows, check the known mismatch:
    - clients use `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`
- If fixing API behavior, ensure clients remain compatible or update them accordingly.

## Validation

- Run the smallest relevant validation for the touched package:
    - Core:
        - `pnpm --filter @media-upload/core build`
        - `pnpm --filter @media-upload/core test`
    - Web:
        - `pnpm --filter web build`
    - Mobile:
        - run the smallest available validation command from `apps/mobile/package.json` or typecheck if available
    - API:
        - validate controller/service behavior
        - verify affected clients still match API contract

- If shared logic changed, validate both core and all consuming apps.

## Output

After fixing, report:

- root cause of the bug
- affected package(s)
- changed files
- validation commands run
- any skipped validation and why
- remaining risks or edge cases