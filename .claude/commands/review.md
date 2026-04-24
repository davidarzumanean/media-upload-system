# Review Command

Use this command to review code changes for correctness, boundaries, and risks.

## Process

1. Read root `CLAUDE.md`.
2. Identify affected packages from the diff.
3. Read only relevant package `CLAUDE.md`.
4. Inspect only changed files and directly related code.
5. Evaluate changes against boundaries, contracts, and correctness.
6. Identify issues, risks, and missing validation.
7. Provide actionable feedback with clear severity.

## Boundary Checks

- No shared upload logic duplicated between `apps/web` and `apps/mobile`
- No framework/platform code leaking into `packages/upload-core`
- No dependency or coupling from `apps/api` to `packages/upload-core`
- Changes are implemented in the correct package
- No unnecessary cross-package changes

## Contract Checks

- No unintended changes to shared types or public APIs
- No breaking changes to API responses or request shapes
- Client/API contract remains aligned
- Known cancel mismatch handled correctly:
    - clients use `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`

## Code Quality Checks

- Changes are minimal and focused
- No unnecessary abstractions introduced
- No duplication of existing logic
- Existing patterns and architecture are respected

## Validation Checks

- Correct validation commands were run for affected packages:
    - Core:
        - `pnpm --filter @media-upload/core build`
        - `pnpm --filter @media-upload/core test`
    - Web:
        - `pnpm --filter web build`
    - Mobile:
        - appropriate minimal validation or typecheck
    - API:
        - route/controller/service consistency verified

- If shared logic changed, both core and consuming apps were validated

## Output

Structure the review as:

### Issues

- [severity: high/medium/low] description + file reference

### Risks

- potential edge cases or regressions

### Missing Validation

- what was not validated but should be

### Suggestions

- concrete improvements (only if meaningful)

### Summary

- overall assessment (safe to merge / needs fixes / risky)