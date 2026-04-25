<?php

namespace App\Tests\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

class UploadControllerTest extends WebTestCase
{
    protected function setUp(): void
    {
        // Boot the kernel once per test; subsequent calls within the test use getClient().
        static::createClient();

        /** @var Connection $conn */
        $conn = static::getContainer()->get(Connection::class);

        // Ensure schema exists (UploadService creates it in its constructor, but
        // we guard here in case the service hasn't been initialised yet).
        $conn->executeStatement('
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

        // Wipe data so every test starts clean.
        $conn->executeStatement('DELETE FROM uploads');
    }

    // ─── helpers ──────────────────────────────────────────────────────────────

    /**
     * POST /api/uploads/initiate and return the decoded JSON body.
     * Uses getClient() — kernel was already booted in setUp().
     */
    private function initiate(array $payload = []): array
    {
        $client = static::getClient();

        $defaults = [
            'name'     => 'photo.jpg',
            'size'     => 2_097_152,
            'mimeType' => 'image/jpeg',
            'fileId'   => 'client-file-id',
        ];

        $client->request(
            'POST',
            '/api/uploads/initiate',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(array_merge($defaults, $payload))
        );

        return json_decode($client->getResponse()->getContent(), true);
    }

    /**
     * Creates a real temp file and wraps it in UploadedFile for multipart
     * chunk upload simulation.
     */
    private function makeChunkFile(string $content = 'chunk-data'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'test_chunk_');
        file_put_contents($path, $content);

        return new UploadedFile($path, 'chunk.bin', 'application/octet-stream', null, true);
    }

    /**
     * Uploads a minimal valid JPEG split across $totalChunks chunks via the
     * real HTTP stack (POST /api/uploads/{id}/chunks/{i}).
     */
    private function uploadAllChunks(string $uploadId, int $totalChunks): void
    {
        $client = static::getClient();

        // Minimal JPEG magic bytes that finfo correctly identifies as image/jpeg.
        $jpeg = "\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
              . "\xFF\xDB\x00\x43\x00" . str_repeat("\x08", 64)
              . "\xFF\xD9";

        $bytes     = strlen($jpeg);
        $chunkSize = (int) ceil($bytes / $totalChunks);

        for ($i = 0; $i < $totalChunks; $i++) {
            $slice = substr($jpeg, $i * $chunkSize, $chunkSize);
            $path  = tempnam(sys_get_temp_dir(), 'test_chunk_');
            file_put_contents($path, $slice);

            $file = new UploadedFile($path, 'chunk.bin', 'application/octet-stream', null, true);

            $client->request(
                'POST',
                "/api/uploads/{$uploadId}/chunks/{$i}",
                [],
                ['chunk' => $file]
            );
        }
    }

    // ─── initiate ─────────────────────────────────────────────────────────────

    public function testInitiateSuccess(): void
    {
        $client = static::getClient();

        $client->request(
            'POST',
            '/api/uploads/initiate',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode([
                'name'     => 'photo.jpg',
                'size'     => 2_097_152,
                'mimeType' => 'image/jpeg',
                'fileId'   => 'abc123',
            ])
        );

        $this->assertResponseStatusCodeSame(201);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('uploadId',    $data);
        $this->assertArrayHasKey('totalChunks', $data);
        $this->assertSame(2, $data['totalChunks']); // 2 MB / 1 MB = 2 chunks
    }

    public function testInitiateMissingFields(): void
    {
        $client = static::getClient();

        $client->request(
            'POST',
            '/api/uploads/initiate',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['size' => 1_000_000, 'mimeType' => 'image/jpeg']) // name missing
        );

        $this->assertResponseStatusCodeSame(400);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('missing', $data);
        $this->assertContains('name', $data['missing']);
    }

    public function testInitiateInvalidMimeType(): void
    {
        $client = static::getClient();

        $client->request(
            'POST',
            '/api/uploads/initiate',
            [],
            [],
            ['CONTENT_TYPE' => 'application/json'],
            json_encode(['name' => 'doc.txt', 'size' => 1024, 'mimeType' => 'text/plain'])
        );

        $this->assertResponseStatusCodeSame(400);

        $data = json_decode($client->getResponse()->getContent(), true);
        $this->assertArrayHasKey('error', $data);
    }

    // ─── chunk upload ─────────────────────────────────────────────────────────

    public function testChunkUpload(): void
    {
        $init     = $this->initiate();
        $uploadId = $init['uploadId'];

        $file = $this->makeChunkFile();
        static::getClient()->request(
            'POST',
            "/api/uploads/{$uploadId}/chunks/0",
            [],
            ['chunk' => $file]
        );

        $this->assertResponseIsSuccessful();

        $data = json_decode(static::getClient()->getResponse()->getContent(), true);
        $this->assertTrue($data['received']);
        $this->assertSame(0, $data['chunkIndex']);
    }

    public function testChunkUploadInvalidIndex(): void
    {
        $init     = $this->initiate(['size' => 1_048_576]); // 1 MB → 1 chunk (index 0 only)
        $uploadId = $init['uploadId'];

        $file = $this->makeChunkFile();
        // Index 1 is out of range for a 1-chunk upload
        static::getClient()->request(
            'POST',
            "/api/uploads/{$uploadId}/chunks/1",
            [],
            ['chunk' => $file]
        );

        $this->assertResponseStatusCodeSame(400);
    }

    public function testChunkUploadNotFound(): void
    {
        $file = $this->makeChunkFile();
        static::getClient()->request(
            'POST',
            '/api/uploads/non-existent-id/chunks/0',
            [],
            ['chunk' => $file]
        );

        $this->assertResponseStatusCodeSame(404);
    }

    // ─── finalize ─────────────────────────────────────────────────────────────

    public function testFinalizeSuccess(): void
    {
        $init        = $this->initiate(['size' => 100, 'name' => 'photo.jpg']);
        $uploadId    = $init['uploadId'];
        $totalChunks = $init['totalChunks'];

        $this->uploadAllChunks($uploadId, $totalChunks);

        static::getClient()->request('POST', "/api/uploads/{$uploadId}/finalize");

        $this->assertResponseIsSuccessful();

        $data = json_decode(static::getClient()->getResponse()->getContent(), true);
        $this->assertSame('completed', $data['status']);
    }

    // ─── status ───────────────────────────────────────────────────────────────

    public function testStatusEndpoint(): void
    {
        $init     = $this->initiate(['size' => 2_097_152]); // 2 chunks
        $uploadId = $init['uploadId'];

        // Upload only chunk 0
        $file = $this->makeChunkFile();
        static::getClient()->request(
            'POST',
            "/api/uploads/{$uploadId}/chunks/0",
            [],
            ['chunk' => $file]
        );

        static::getClient()->request('GET', "/api/uploads/{$uploadId}/status");

        $this->assertResponseIsSuccessful();

        $data = json_decode(static::getClient()->getResponse()->getContent(), true);
        $this->assertContains(0, $data['uploadedChunks']);
        $this->assertContains(1, $data['missingChunks']);
    }

    // ─── delete (cancel) ──────────────────────────────────────────────────────

    public function testDeleteEndpoint(): void
    {
        $init     = $this->initiate();
        $uploadId = $init['uploadId'];

        static::getClient()->request('DELETE', "/api/uploads/{$uploadId}");

        $this->assertResponseIsSuccessful();

        $data = json_decode(static::getClient()->getResponse()->getContent(), true);
        $this->assertSame('canceled', $data['status']);
    }

    // ─── serve file ───────────────────────────────────────────────────────────

    public function testServeFileSuccess(): void
    {
        $init        = $this->initiate(['size' => 100, 'name' => 'photo.jpg', 'mimeType' => 'image/jpeg']);
        $uploadId    = $init['uploadId'];
        $totalChunks = $init['totalChunks'];

        $this->uploadAllChunks($uploadId, $totalChunks);

        static::getClient()->request('POST', "/api/uploads/{$uploadId}/finalize");
        $this->assertResponseIsSuccessful();

        static::getClient()->request('GET', "/api/uploads/{$uploadId}/file");

        $this->assertResponseStatusCodeSame(200);
        $contentType = static::getClient()->getResponse()->headers->get('Content-Type');
        $this->assertStringStartsWith('image/jpeg', $contentType);
    }

    public function testServeFileNotFound(): void
    {
        static::getClient()->request('GET', '/api/uploads/nonexistent-upload-id/file');

        $this->assertResponseStatusCodeSame(404);
    }

    public function testServeFileNotCompleted(): void
    {
        $init     = $this->initiate();
        $uploadId = $init['uploadId'];

        // Do not finalize — upload remains in pending/uploading state
        static::getClient()->request('GET', "/api/uploads/{$uploadId}/file");

        $this->assertResponseStatusCodeSame(404);
    }
}