<?php

namespace App\Command;

use App\Service\UploadService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:cleanup:expired',
    description: 'Remove completed uploads older than 30 days'
)]
class CleanupExpiredCommand extends Command
{
    public function __construct(
        private readonly UploadService $uploadService
    ) {
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $cleaned = $this->uploadService->cleanupExpiredFiles(30);
        $output->writeln("Cleaned up {$cleaned} expired files.");
        return Command::SUCCESS;
    }
}