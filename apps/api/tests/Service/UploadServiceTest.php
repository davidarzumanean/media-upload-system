<?php

namespace App\Tests\Service;

use App\Service\UploadService;
use Doctrine\DBAL\DriverManager;
use PHPUnit\Framework\TestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class UploadServiceTest extends TestCase
{
    private UploadService $service;
    private string $tmpDir;
    private string $finalDir;

    protected function setUp(): void
    {
        // Real in-memory SQLite connection — isolated per test (DBAL v4 requires explicit driver)
        $connection = DriverManager::getConnection(['driver' => 'pdo_sqlite', 'memory' => true]);

        $this->service = new UploadService($connection);

        // Override hardcoded paths with per-test temp directories via reflection
        $this->tmpDir   = sys_get_temp_dir() . '/upload_test_tmp_' . uniqid();
        $this->finalDir = sys_get_temp_dir() . '/upload_test_final_' . uniqid();
        mkdir($this->tmpDir,   0777, true);
        mkdir($this->finalDir, 0777, true);

        $ref = new \ReflectionClass($this->service);

        $tmpProp = $ref->getProperty('tmpDir');
        $tmpProp->setValue($this->service, $this->tmpDir);

        $finalProp = $ref->getProperty('finalDir');
        $finalProp->setValue($this->service, $this->finalDir);
    }

    protected function tearDown(): void
    {
        $this->rmrf($this->tmpDir);
        $this->rmrf($this->finalDir);
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private function rmrf(string $path): void
    {
        if (!file_exists($path)) {
            return;
        }
        if (is_file($path)) {
            unlink($path);
            return;
        }
        foreach (scandir($path) as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $this->rmrf($path . '/' . $entry);
        }
        rmdir($path);
    }

    /**
     * Creates a real temporary file and wraps it in an UploadedFile so
     * saveChunk() can call $file->move().
     */
    private function makeTempUploadedFile(string $content, string $name = 'chunk.bin'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'chunk_');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, 'application/octet-stream', null, true);
    }

    /**
     * Writes a minimal valid JPEG (smallest real JPEG) into $totalChunks
     * part-files directly so finalizeUpload() can assemble a real image.
     */
    private function writeJpegChunks(string $uploadId, int $totalChunks): void
    {
        // 35-byte minimal JPEG that finfo correctly identifies as image/jpeg
        $jpeg = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
              . "\xFF\xDB\x00\x43\x00" . str_repeat("\x08", 64)
              . "\xFF\xD9";

        $chunkDir = $this->tmpDir . '/' . $uploadId;
        mkdir($chunkDir, 0777, true);

        // Distribute bytes across chunks (last chunk gets the remainder)
        $bytes     = strlen($jpeg);
        $chunkSize = (int) ceil($bytes / $totalChunks);

        for ($i = 0; $i < $totalChunks; $i++) {
            $slice = substr($jpeg, $i * $chunkSize, $chunkSize);
            file_put_contents($chunkDir . '/' . $i . '.part', $slice);
        }
    }

    // ─── tests ────────────────────────────────────────────────────────────────

    public function testCreateUpload(): void
    {
        $this->service->createUpload('uid-1', 'photo.jpg', 2_097_152, 'image/jpeg', 2, null);

        $row = $this->service->getUpload('uid-1');

        $this->assertNotNull($row);
        $this->assertSame('uid-1',       $row['id']);
        $this->assertSame('photo.jpg',   $row['original_name']);
        $this->assertSame('image/jpeg',  $row['mime_type']);
        $this->assertSame(2_097_152,     (int) $row['file_size']);
        $this->assertSame(2,             (int) $row['total_chunks']);
        $this->assertSame('pending',     $row['status']);
        $this->assertNull($row['md5_checksum']);

        // chunk directory must be created
        $this->assertDirectoryExists($this->tmpDir . '/uid-1');
    }

    public function testGetUploadReturnsNullForUnknownId(): void
    {
        $this->assertNull($this->service->getUpload('does-not-exist'));
    }

    public function testSaveChunk(): void
    {
        $this->service->createUpload('uid-2', 'video.mp4', 1_048_576, 'video/mp4', 1, null);

        $file = $this->makeTempUploadedFile('binary-data', 'chunk.bin');
        $this->service->saveChunk('uid-2', 0, $file);

        $chunks = $this->service->getUploadedChunks('uid-2');
        $this->assertSame([0], $chunks);

        // Part file must exist on disk
        $this->assertFileExists($this->tmpDir . '/uid-2/0.part');
    }

    public function testGetUploadedChunksEmpty(): void
    {
        $this->service->createUpload('uid-3', 'photo.png', 512, 'image/png', 1, null);

        $this->assertSame([], $this->service->getUploadedChunks('uid-3'));
    }

    public function testFinalizeUploadSuccess(): void
    {
        $this->service->createUpload('uid-4', 'photo.jpg', 100, 'image/jpeg', 2, null);

        $this->writeJpegChunks('uid-4', 2);

        $upload = $this->service->getUpload('uid-4');
        $result = $this->service->finalizeUpload('uid-4', $upload);

        $this->assertArrayNotHasKey('error', $result);
        $this->assertSame('completed',    $result['status']);
        $this->assertFalse($result['deduplicated']);

        // DB record updated
        $row = $this->service->getUpload('uid-4');
        $this->assertSame('completed', $row['status']);
        $this->assertNotNull($row['md5_checksum']);
        $this->assertNotEmpty($row['final_path']);

        // Final file must exist
        $this->assertFileExists($this->finalDir . '/' . $row['final_path']);

        // Chunk directory must be cleaned up
        $this->assertDirectoryDoesNotExist($this->tmpDir . '/uid-4');
    }

    public function testFinalizeUploadMissingChunks(): void
    {
        $this->service->createUpload('uid-5', 'photo.jpg', 2_097_152, 'image/jpeg', 2, null);

        // Only upload chunk 0, not chunk 1
        $file = $this->makeTempUploadedFile('partial', 'chunk.bin');
        $this->service->saveChunk('uid-5', 0, $file);

        $upload = $this->service->getUpload('uid-5');
        $result = $this->service->finalizeUpload('uid-5', $upload);

        $this->assertArrayHasKey('error',   $result);
        $this->assertSame('Missing chunks', $result['error']);
        $this->assertContains(1, $result['missing']);
    }

    public function testFinalizeUploadInvalidMimeType(): void
    {
        $this->service->createUpload('uid-6', 'notes.txt', 13, 'text/plain', 1, null);

        // Write a plain-text chunk directly
        $chunkDir = $this->tmpDir . '/uid-6';
        mkdir($chunkDir, 0777, true);
        file_put_contents($chunkDir . '/0.part', 'Hello, world!');

        $upload = $this->service->getUpload('uid-6');
        $result = $this->service->finalizeUpload('uid-6', $upload);

        $this->assertArrayHasKey('error', $result);
        $this->assertStringContainsString('File type not allowed', $result['error']);

        $row = $this->service->getUpload('uid-6');
        $this->assertSame('failed', $row['status']);
    }

    public function testDeduplication(): void
    {
        // First upload
        $this->service->createUpload('uid-7a', 'photo.jpg', 100, 'image/jpeg', 1, null);
        $this->writeJpegChunks('uid-7a', 1);
        $first = $this->service->finalizeUpload('uid-7a', $this->service->getUpload('uid-7a'));

        $this->assertSame('completed', $first['status']);
        $this->assertFalse($first['deduplicated']);

        // Second upload — identical content
        $this->service->createUpload('uid-7b', 'photo-copy.jpg', 100, 'image/jpeg', 1, null);
        $this->writeJpegChunks('uid-7b', 1);
        $second = $this->service->finalizeUpload('uid-7b', $this->service->getUpload('uid-7b'));

        $this->assertSame('completed', $second['status']);
        $this->assertTrue($second['deduplicated']);
        $this->assertSame($first['path'], $second['path']);
    }

    public function testCancelUpload(): void
    {
        $this->service->createUpload('uid-8', 'photo.jpg', 1_048_576, 'image/jpeg', 1, null);

        // Save a chunk so the directory exists
        $file = $this->makeTempUploadedFile('data', 'chunk.bin');
        $this->service->saveChunk('uid-8', 0, $file);

        $this->service->cancelUpload('uid-8');

        $row = $this->service->getUpload('uid-8');
        $this->assertSame('canceled', $row['status']);

        // Chunks must be deleted
        $this->assertDirectoryDoesNotExist($this->tmpDir . '/uid-8');
    }

    public function testCleanupStaleChunks(): void
    {
        $this->service->createUpload('uid-9', 'photo.jpg', 1_048_576, 'image/jpeg', 1, null);

        // Manually back-date updated_at to 31 minutes ago
        $staleTime = date('c', strtotime('-31 minutes'));
        $ref = new \ReflectionClass($this->service);
        $connProp = $ref->getProperty('connection');
        /** @var \Doctrine\DBAL\Connection $conn */
        $conn = $connProp->getValue($this->service);
        $conn->update('uploads', ['updated_at' => $staleTime], ['id' => 'uid-9']);

        $cleaned = $this->service->cleanupStaleChunks(30);

        $this->assertGreaterThanOrEqual(1, $cleaned);

        $row = $this->service->getUpload('uid-9');
        $this->assertSame('failed', $row['status']);
    }

    public function testCleanupExpiredFiles(): void
    {
        // Create and finalize a real upload
        $this->service->createUpload('uid-10', 'photo.jpg', 100, 'image/jpeg', 1, null);
        $this->writeJpegChunks('uid-10', 1);
        $this->service->finalizeUpload('uid-10', $this->service->getUpload('uid-10'));

        $row = $this->service->getUpload('uid-10');
        $this->assertSame('completed', $row['status']);
        $finalPath = $this->finalDir . '/' . $row['final_path'];
        $this->assertFileExists($finalPath);

        // Back-date to 31 days ago
        $ref = new \ReflectionClass($this->service);
        $connProp = $ref->getProperty('connection');
        /** @var \Doctrine\DBAL\Connection $conn */
        $conn = $connProp->getValue($this->service);
        $conn->update('uploads', ['updated_at' => date('c', strtotime('-31 days'))], ['id' => 'uid-10']);

        $deleted = $this->service->cleanupExpiredFiles(30);

        $this->assertGreaterThanOrEqual(1, $deleted);
        $this->assertFileDoesNotExist($finalPath);
        $this->assertNull($this->service->getUpload('uid-10'));
    }

    public function testCleanupExpiredFilesPreservesSharedPath(): void
    {
        // First upload — owns the file on disk
        $this->service->createUpload('uid-11a', 'photo.jpg', 100, 'image/jpeg', 1, null);
        $this->writeJpegChunks('uid-11a', 1);
        $first = $this->service->finalizeUpload('uid-11a', $this->service->getUpload('uid-11a'));
        $sharedPath = $first['path'];

        // Second upload — deduplicated, references the same final_path
        $this->service->createUpload('uid-11b', 'photo-copy.jpg', 100, 'image/jpeg', 1, null);
        $this->writeJpegChunks('uid-11b', 1);
        $second = $this->service->finalizeUpload('uid-11b', $this->service->getUpload('uid-11b'));
        $this->assertTrue($second['deduplicated']);
        $this->assertSame($sharedPath, $second['path']);

        // Back-date uid-11a past the retention threshold
        $ref = new \ReflectionClass($this->service);
        $connProp = $ref->getProperty('connection');
        /** @var \Doctrine\DBAL\Connection $conn */
        $conn = $connProp->getValue($this->service);
        $conn->update('uploads', ['updated_at' => date('c', strtotime('-31 days'))], ['id' => 'uid-11a']);

        $deleted = $this->service->cleanupExpiredFiles(30);

        $this->assertSame(1, $deleted);
        $this->assertNull($this->service->getUpload('uid-11a'));
        $this->assertNotNull($this->service->getUpload('uid-11b'));
        // File must survive — uid-11b still references it
        $this->assertFileExists($this->finalDir . '/' . $sharedPath);
    }
}