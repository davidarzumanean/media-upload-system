<?php

namespace App\Controller;

use App\Service\UploadService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Uid\Uuid;

#[Route('/api/uploads')]
class UploadController extends AbstractController
{
    private const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB
    private const ACTIVE_STATUSES = ['pending', 'uploading'];

    public function __construct(
        private readonly UploadService $uploadService
    ) {}

    #[Route('/initiate', methods: ['POST'])]
    public function initiate(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);

        $name = $data['name'] ?? null;
        $size = $data['size'] ?? null;
        $mimeType = $data['mimeType'] ?? null;
        $fileId = $data['fileId'] ?? null;

        $missing = [];
        if (!$name) $missing[] = 'name';
        if ($size === null || $size === '') $missing[] = 'size';
        if (!$mimeType) $missing[] = 'mimeType';
        if ($missing) {
            return $this->json(['error' => 'Missing required fields', 'missing' => $missing], 400);
        }

        $size = (int) $size;
        if ($size <= 0) {
            return $this->json(['error' => 'size must be a positive integer'], 400);
        }
        if ($size > self::MAX_FILE_SIZE) {
            return $this->json(['error' => 'File too large', 'maxBytes' => self::MAX_FILE_SIZE], 400);
        }

        $allowedPrefixes = ['image/', 'video/'];
        $valid = false;
        foreach ($allowedPrefixes as $prefix) {
            if (str_starts_with($mimeType, $prefix)) {
                $valid = true;
                break;
            }
        }
        if (!$valid) {
            return $this->json(['error' => 'Invalid file type', 'mimeType' => $mimeType], 400);
        }

        $chunkSize = 1048576; // 1MB
        $totalChunks = (int) ceil($size / $chunkSize);

        $uploadId = Uuid::v4()->toRfc4122();

        $this->uploadService->createUpload($uploadId, $name, $size, $mimeType, $totalChunks, $fileId);

        return $this->json([
            'uploadId' => $uploadId,
            'totalChunks' => $totalChunks,
        ], 201);
    }

    #[Route('/{uploadId}/chunks/{chunkIndex}', methods: ['POST'], requirements: ['chunkIndex' => '\d+'])]
    public function uploadChunk(string $uploadId, int $chunkIndex, Request $request): JsonResponse
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload) {
            return $this->json(['error' => 'Upload not found'], 404);
        }

        if (!in_array($upload['status'], self::ACTIVE_STATUSES, true)) {
            return $this->json(['error' => 'Upload is not accepting chunks', 'status' => $upload['status']], 409);
        }

        $chunkFile = $request->files->get('chunk');
        if (!$chunkFile) {
            return $this->json(['error' => 'No chunk data received'], 400);
        }

        if ($chunkIndex < 0 || $chunkIndex >= (int)$upload['total_chunks']) {
            return $this->json(['error' => 'Invalid chunk index'], 400);
        }

        $this->uploadService->saveChunk($uploadId, $chunkIndex, $chunkFile);

        return $this->json([
            'received' => true,
            'chunkIndex' => $chunkIndex,
        ]);
    }

    #[Route('/{uploadId}/finalize', methods: ['POST'])]
    public function finalize(string $uploadId): JsonResponse
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload) {
            return $this->json(['error' => 'Upload not found'], 404);
        }

        if (!in_array($upload['status'], self::ACTIVE_STATUSES, true)) {
            return $this->json(['error' => 'Upload cannot be finalized', 'status' => $upload['status']], 409);
        }

        $result = $this->uploadService->finalizeUpload($uploadId, $upload);
        if (isset($result['error'])) {
            return $this->json($result, 400);
        }

        return $this->json($result);
    }

    #[Route('/{uploadId}/status', methods: ['GET'])]
    public function status(string $uploadId): JsonResponse
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload) {
            return $this->json(['error' => 'Upload not found'], 404);
        }

        $uploadedChunks = $this->uploadService->getUploadedChunks($uploadId);
        $totalChunks = (int)$upload['total_chunks'];
        $allChunks = range(0, $totalChunks - 1);
        $missingChunks = array_values(array_diff($allChunks, $uploadedChunks));

        return $this->json([
            'status' => $upload['status'],
            'uploadedChunks' => $uploadedChunks,
            'missingChunks' => $missingChunks,
            'progress' => $totalChunks > 0 ? round(count($uploadedChunks) / $totalChunks * 100) : 0,
        ]);
    }

    #[Route('/{uploadId}/file', methods: ['GET'])]
    public function serveFile(string $uploadId): Response
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload || $upload['status'] !== 'completed' || empty($upload['final_path'])) {
            return $this->json(['error' => 'File not found'], 404);
        }

        $fullPath = $this->getParameter('kernel.project_dir') . '/var/uploads/final/' . $upload['final_path'];
        if (!file_exists($fullPath)) {
            return $this->json(['error' => 'File not found on disk'], 404);
        }

        return new BinaryFileResponse($fullPath);
    }

    #[Route('/{uploadId}', methods: ['DELETE'])]
    public function delete(string $uploadId): JsonResponse
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload) {
            return $this->json(['error' => 'Upload not found'], 404);
        }

        $this->uploadService->cancelUpload($uploadId);

        return $this->json(['status' => 'canceled']);
    }
}