# Refactor Command

Use this command to improve code structure without changing external behavior.

## Process

1. Read root `CLAUDE.md`.
2. Identify the smallest affected package.
3. Read only the relevant package `CLAUDE.md`.
4. Inspect only necessary files.
5. Identify the exact refactor goal (e.g., simplify logic, remove duplication, improve structure).
6. Confirm that behavior must remain unchanged.
7. Write a short plan before editing.
8. Apply minimal, incremental changes.
9. Run narrow validation.
10. Summarize changes, validation, and risks.

## Boundary Rules

- Preserve package boundaries.
- Do not move framework-specific code into `packages/upload-core`.
- Do not duplicate shared logic into `apps/web` or `apps/mobile`.
- Do not introduce any dependency from `apps/api` to `packages/upload-core`.
- Do not move API logic into clients.
- Prefer improving existing abstractions over creating new ones.
- Avoid large cross-package refactors unless explicitly required.

## Safety Rules

- Do not change public APIs or contracts unless explicitly requested.
- Do not rename exported types, functions, or classes unless required.
- Do not change data shapes returned by API or used by clients.
- Do not introduce behavioral changes while refactoring.
- Keep diffs small and focused.

## API Contract Rules

- Watch the cancel-route mismatch before refactoring API/client boundaries:
    - clients use `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`
- Do not accidentally align or change this unless explicitly requested.

## Validation

- Core:
    - `pnpm --filter @media-upload/core build`
    - `pnpm --filter @media-upload/core test`
- Web:
    - `pnpm --filter web build`
- Mobile:
    - run the smallest available validation command from `apps/mobile/package.json` or typecheck if available
- API:
    - verify route/controller/service compatibility with clients

- If shared logic is affected, validate both core and all consuming apps.

## Output

After refactoring, report:

- refactor goal
- affected package(s)
- changed files
- confirmation that behavior is unchanged
- validation commands run
- any skipped validation and why
- potential risks or follow-up improvements