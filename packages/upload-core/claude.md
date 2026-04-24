# upload-core Rules

- Keep this package framework-agnostic.
- Do not add React, React Native, Expo, browser DOM, or Symfony dependencies.
- Shared upload orchestration belongs here.
- Shared validation, chunking, status transitions, retries, and shared types belong here.
- UI components, routing, storage adapters, and platform file pickers do not belong here.
- API transport details do not belong here beyond the `ApiClient` interface.
- Platform file-reading details do not belong here beyond the `ChunkReader` interface.

## Change Rules

- Prefer extending existing `UploadManager`, types, and helpers over creating parallel abstractions.
- Keep exports minimal and intentional.
- If web and mobile would need the same behavior, implement it here once.

## Validation

- Run: `pnpm --filter @media-upload/core build`
- Run: `pnpm --filter @media-upload/core test`
- If public types or manager behavior changed, ensure both apps can still consume the package.
