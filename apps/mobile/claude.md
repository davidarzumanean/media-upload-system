# apps/mobile Rules

- Keep changes mobile-specific.
- Do not duplicate shared upload logic that belongs in `packages/upload-core`.
- Mobile-only concerns stay here:
    - Expo pickers
    - local file URI handling
    - AsyncStorage history
    - React Native UI
    - mobile fetch client
- Do not move native/platform code into `upload-core`.

## Integration Rules

- Use `@media-upload/core` for upload state, actions, types, validation, and shared formatting/tokens.
- Keep the mobile hook/provider as the adapter layer around the shared manager.
- If web and mobile need the same behavior, implement it once in `upload-core`.

## API Contract Warning

- Known mismatch:
    - clients use `DELETE /uploads/{id}`
    - API exposes `POST /{uploadId}/cancel`
- Check cancel behavior before changing mobile actions.

## Validation

- Validate only the touched mobile code paths.
- If shared logic was changed, also run core build/tests.
