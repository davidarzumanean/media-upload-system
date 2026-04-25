# API Reference

Base URL: `http://localhost:8000/api`

All endpoints return JSON. File chunks are sent as `multipart/form-data`.

## Endpoints

### Initiate Upload

Validates file metadata and creates an upload session.

```
POST /api/uploads/initiate
Content-Type: application/json
```

**Request body:**

| Field    | Type   | Required | Description                        |
|----------|--------|----------|------------------------------------|
| name     | string | yes      | Original filename                  |
| size     | number | yes      | File size in bytes                 |
| mimeType | string | yes      | MIME type (must start with image/ or video/) |
| fileId   | string | no       | Client-side file identifier        |

**Response (201):**

```json
{
  "uploadId": "18d959db-533f-4ff8-994f-f0ff9f22b376",
  "totalChunks": 5
}
```

**Errors:**
- `400` — Missing required fields (returns `{ error, missing: [...] }`)
- `400` — Invalid MIME type (returns `{ error, mimeType }`)

The server calculates `totalChunks` from the file size using 1 MB (1,048,576 bytes) chunk size.

---

### Upload Chunk

Sends a single 1 MB chunk of a file.

```
POST /api/uploads/{uploadId}/chunks/{chunkIndex}
Content-Type: multipart/form-data
```

**Form fields:**

| Field | Type | Description              |
|-------|------|--------------------------|
| chunk | file | The chunk binary data    |

**Response (200):**

```json
{
  "received": true,
  "chunkIndex": 0
}
```

**Errors:**
- `404` — Upload ID not found
- `400` — No chunk data received
- `400` — Invalid chunk index (out of range)

Chunks can be uploaded in any order and in parallel (client limits to 3 concurrent). Re-uploading the same chunk index overwrites the previous one (idempotent).

---

### Finalize Upload

Triggers file reassembly, validation, and storage.

```
POST /api/uploads/{uploadId}/finalize
```

**Response (200):**

```json
{
  "status": "completed",
  "fileId": "18d959db-533f-4ff8-994f-f0ff9f22b376",
  "path": "2026/04/25/a1b2c3d4_photo.jpg",
  "deduplicated": false
}
```

**Server-side processing:**

1. Verifies all chunks are present
2. Reassembles chunks into a single file (concatenation in order)
3. Validates file type via magic number detection (php finfo)
4. Computes MD5 checksum
5. Checks for duplicate files (same MD5) — if found, points to existing file
6. Stores file in `var/uploads/final/{YYYY/MM/DD}/{md5}_{filename}`
7. Cleans up chunk directory

**Errors:**
- `404` — Upload ID not found
- `400` — Missing chunks (returns `{ error, missing: [...] }`)
- `400` — File type not allowed after magic number check (returns `{ error, detected }`)

**Allowed MIME types (magic number validation):**

Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `image/bmp`, `image/avif`

Videos: `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/webm`, `video/mpeg`

---

### Upload Status

Query the current state of an upload.

```
GET /api/uploads/{uploadId}/status
```

**Response (200):**

```json
{
  "status": "uploading",
  "uploadedChunks": [0, 1, 2],
  "missingChunks": [3, 4],
  "progress": 60
}
```

**Errors:**
- `404` — Upload ID not found

---

### Cancel / Delete Upload

Cancels an upload and cleans up chunks. Two equivalent routes are exposed:

```
DELETE /api/uploads/{uploadId}
POST   /api/uploads/{uploadId}/cancel
```

Both routes return the same response. Clients use `DELETE`; the `POST` route exists for environments that cannot issue DELETE requests.

**Response (200):**

```json
{
  "status": "canceled"
}
```

**Errors:**
- `404` — Upload ID not found

---

### Serve File

Returns the uploaded file for download or display (used for history thumbnails).

```
GET /api/uploads/{uploadId}/file
```

**Response (200):** Binary file with appropriate Content-Type header.

**Errors:**
- `404` — Upload not found, not completed, or file missing from disk

---

## Database Schema

Single `uploads` table (SQLite):

| Column          | Type    | Description                              |
|-----------------|---------|------------------------------------------|
| id              | TEXT    | UUID primary key                         |
| original_name   | TEXT    | Original filename                        |
| mime_type       | TEXT    | Client-declared MIME type                |
| file_size       | INTEGER | File size in bytes                       |
| total_chunks    | INTEGER | Number of expected chunks                |
| status          | TEXT    | pending, uploading, completed, failed, canceled |
| created_at      | TEXT    | ISO 8601 timestamp                       |
| updated_at      | TEXT    | ISO 8601 timestamp                       |
| md5_checksum    | TEXT    | MD5 hash of the final assembled file     |
| final_path      | TEXT    | Relative path in the final storage dir   |
| client_checksum | TEXT    | Optional checksum from the client        |

## CORS

All endpoints include CORS headers allowing requests from any origin (`Access-Control-Allow-Origin: *`). In production, this should be restricted to specific domains.