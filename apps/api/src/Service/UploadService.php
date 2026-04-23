<?php

namespace App\Service;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class UploadService
{
    private string $tmpDir;
    private string $finalDir;

    public function __construct(
        private readonly Connection $connection
    ) {
        $this->tmpDir = dirname(__DIR__, 2) . '/var/uploads/tmp';
        $this->finalDir = dirname(__DIR__, 2) . '/var/uploads/final';
        $this->ensureSchema();
    }

    private function ensureSchema(): void
    {
        $this->connection->executeStatement('
            CREATE TABLE IF NOT EXISTS uploads (
                id TEXT PRIMARY KEY,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                total_chunks INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT "pending",
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                md5_checksum TEXT,
                final_path TEXT,
                client_checksum TEXT
            )
        ');
    }

    public function createUpload(
        string $uploadId,
        string $fileName,
        int $fileSize,
        string $mimeType,
        int $totalChunks,
        ?string $checksum
    ): void {
        $now = date('c');
        $this->connection->insert('uploads', [
            'id' => $uploadId,
            'original_name' => $fileName,
            'mime_type' => $mimeType,
            'file_size' => $fileSize,
            'total_chunks' => $totalChunks,
            'status' => 'pending',
            'created_at' => $now,
            'updated_at' => $now,
            'client_checksum' => $checksum,
        ]);

        $chunkDir = $this->tmpDir . '/' . $uploadId;
        if (!is_dir($chunkDir)) {
            mkdir($chunkDir, 0777, true);
        }
    }

    public function getUpload(string $uploadId): ?array
    {
        $result = $this->connection->fetchAssociative(
            'SELECT * FROM uploads WHERE id = ?',
            [$uploadId]
        );
        return $result ?: null;
    }

    public function saveChunk(string $uploadId, int $chunkIndex, UploadedFile $chunkFile): void
    {
        $chunkDir = $this->tmpDir . '/' . $uploadId;
        if (!is_dir($chunkDir)) {
            mkdir($chunkDir, 0777, true);
        }

        $chunkFile->move($chunkDir, $chunkIndex . '.part');

        $this->connection->update('uploads', [
            'status' => 'uploading',
            'updated_at' => date('c'),
        ], ['id' => $uploadId]);
    }

    public function getUploadedChunks(string $uploadId): array
    {
        $chunkDir = $this->tmpDir . '/' . $uploadId;
        if (!is_dir($chunkDir)) {
            return [];
        }

        $chunks = [];
        foreach (scandir($chunkDir) as $file) {
            if (str_ends_with($file, '.part')) {
                $chunks[] = (int) str_replace('.part', '', $file);
            }
        }
        sort($chunks);
        return $chunks;
    }

    public function finalizeUpload(string $uploadId, array $upload): array
    {
        $totalChunks = (int) $upload['total_chunks'];
        $uploadedChunks = $this->getUploadedChunks($uploadId);

        if (count($uploadedChunks) !== $totalChunks) {
            return ['error' => 'Missing chunks', 'missing' => array_values(array_diff(range(0, $totalChunks - 1), $uploadedChunks))];
        }

        // Reassemble file
        $chunkDir = $this->tmpDir . '/' . $uploadId;
        $tmpFile = $chunkDir . '/assembled';
        $out = fopen($tmpFile, 'wb');

        for ($i = 0; $i < $totalChunks; $i++) {
            $partPath = $chunkDir . '/' . $i . '.part';
            $in = fopen($partPath, 'rb');
            stream_copy_to_stream($in, $out);
            fclose($in);
        }
        fclose($out);

        // Magic number validation
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($tmpFile);
        $allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp',
            'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
        ];

        if (!in_array($detectedMime, $allowedMimes, true)) {
            unlink($tmpFile);
            $this->updateStatus($uploadId, 'failed');
            return ['error' => 'File type not allowed', 'detected' => $detectedMime];
        }

        // MD5 checksum + dedup
        $md5 = md5_file($tmpFile);

        $existing = $this->connection->fetchAssociative(
            'SELECT * FROM uploads WHERE md5_checksum = ? AND status = ? AND id != ?',
            [$md5, 'completed', $uploadId]
        );

        if ($existing) {
            // Deduplicated — point to existing file
            unlink($tmpFile);
            $this->cleanupChunks($uploadId);
            $this->connection->update('uploads', [
                'status' => 'completed',
                'md5_checksum' => $md5,
                'final_path' => $existing['final_path'],
                'updated_at' => date('c'),
            ], ['id' => $uploadId]);

            return [
                'status' => 'completed',
                'fileId' => $uploadId,
                'path' => $existing['final_path'],
                'deduplicated' => true,
            ];
        }

        // Store final file
        $date = date('Y/m/d');
        $finalSubDir = $this->finalDir . '/' . $date;
        if (!is_dir($finalSubDir)) {
            mkdir($finalSubDir, 0777, true);
        }

        $sanitizedName = preg_replace('/[^a-zA-Z0-9._-]/', '_', $upload['original_name']);
        $finalFileName = $md5 . '_' . $sanitizedName;
        $finalPath = $finalSubDir . '/' . $finalFileName;

        rename($tmpFile, $finalPath);
        $this->cleanupChunks($uploadId);

        $relativePath = $date . '/' . $finalFileName;

        $this->connection->update('uploads', [
            'status' => 'completed',
            'md5_checksum' => $md5,
            'final_path' => $relativePath,
            'updated_at' => date('c'),
        ], ['id' => $uploadId]);

        return [
            'status' => 'completed',
            'fileId' => $uploadId,
            'path' => $relativePath,
            'deduplicated' => false,
        ];
    }

    public function cancelUpload(string $uploadId): void
    {
        $this->updateStatus($uploadId, 'canceled');
        $this->cleanupChunks($uploadId);
    }

    public function cleanupStaleChunks(int $timeoutMinutes = 30): int
    {
        $cutoff = date('c', strtotime("-{$timeoutMinutes} minutes"));
        $stale = $this->connection->fetchAllAssociative(
            'SELECT id FROM uploads WHERE status IN (?, ?) AND updated_at < ?',
            ['pending', 'uploading', $cutoff]
        );

        foreach ($stale as $row) {
            $this->cleanupChunks($row['id']);
            $this->updateStatus($row['id'], 'failed');
        }

        return count($stale);
    }

    public function cleanupExpiredFiles(int $retentionDays = 30): int
    {
        $cutoff = date('c', strtotime("-{$retentionDays} days"));
        $expired = $this->connection->fetchAllAssociative(
            'SELECT id, final_path FROM uploads WHERE status = ? AND updated_at < ?',
            ['completed', $cutoff]
        );

        $count = 0;
        foreach ($expired as $row) {
            if ($row['final_path']) {
                $fullPath = $this->finalDir . '/' . $row['final_path'];
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                }
            }
            $this->connection->delete('uploads', ['id' => $row['id']]);
            $count++;
        }

        return $count;
    }

    private function cleanupChunks(string $uploadId): void
    {
        $chunkDir = $this->tmpDir . '/' . $uploadId;
        if (is_dir($chunkDir)) {
            foreach (scandir($chunkDir) as $file) {
                if ($file !== '.' && $file !== '..') {
                    unlink($chunkDir . '/' . $file);
                }
            }
            rmdir($chunkDir);
        }
    }

    private function updateStatus(string $uploadId, string $status): void
    {
        $this->connection->update('uploads', [
            'status' => $status,
            'updated_at' => date('c'),
        ], ['id' => $uploadId]);
    }
}