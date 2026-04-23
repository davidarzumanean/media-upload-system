export const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB

export function calculateTotalChunks(fileSize: number): number {
  if (fileSize === 0) return 1;
  return Math.ceil(fileSize / CHUNK_SIZE);
}

const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 30_000;

export function getRetryDelay(attempt: number): number {
  const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
  return Math.min(delay, BACKOFF_MAX_MS);
}
