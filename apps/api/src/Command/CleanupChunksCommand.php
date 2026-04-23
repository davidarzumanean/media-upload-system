<?php

namespace App\Command;

use App\Service\UploadService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:cleanup:chunks',
    description: 'Remove stale incomplete uploads older than 30 minutes'
)]
class CleanupChunksCommand extends Command
{
    public function __construct(
        private readonly UploadService $uploadService
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $cleaned = $this->uploadService->cleanupStaleChunks(30);
        $output->writeln("Cleaned up {$cleaned} stale uploads.");
        return Command::SUCCESS;
    }
}