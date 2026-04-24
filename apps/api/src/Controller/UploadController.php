<?php

namespace App\Controller;

use App\Service\UploadService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Uid\Uuid;

#[Route('/api/uploads')]
class UploadController extends AbstractController
{
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

        if (!$name || !$size || !$mimeType) {
            $missing = [];
            if (!$name) $missing[] = 'name';
            if (!$size) $missing[] = 'size';
            if (!$mimeType) $missing[] = 'mimeType';
            return $this->json(['error' => 'Missing required fields', 'missing' => $missing], 400);
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

    #[Route('/{uploadId}/cancel', methods: ['POST'])]
    public function cancel(string $uploadId): JsonResponse
    {
        return $this->doCancel($uploadId);
    }

    #[Route('/{uploadId}', methods: ['DELETE'])]
    public function delete(string $uploadId): JsonResponse
    {
        return $this->doCancel($uploadId);
    }

    private function doCancel(string $uploadId): JsonResponse
    {
        $upload = $this->uploadService->getUpload($uploadId);
        if (!$upload) {
            return $this->json(['error' => 'Upload not found'], 404);
        }

        $this->uploadService->cancelUpload($uploadId);

        return $this->json(['status' => 'canceled']);
    }
}