<?php

namespace App\Command;

use App\Service\UploadService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:cleanup:chunks',
    description: 'Remove stale incomplete uploads older than the given timeout'
)]
class CleanupChunksCommand extends Command
{
    public function __construct(
        private readonly UploadService $uploadService
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('timeout', null, InputOption::VALUE_REQUIRED, 'Stale threshold in minutes', 30);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $timeout = (int) $input->getOption('timeout');
        $cleaned = $this->uploadService->cleanupStaleChunks($timeout);
        $output->writeln("Cleaned up {$cleaned} stale uploads.");
        return Command::SUCCESS;
    }
}