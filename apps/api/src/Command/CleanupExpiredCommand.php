<?php

namespace App\Command;

use App\Service\UploadService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Input\InputOption;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:cleanup:expired',
    description: 'Remove completed uploads older than the given retention period'
)]
class CleanupExpiredCommand extends Command
{
    public function __construct(
        private readonly UploadService $uploadService
    ) {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this->addOption('days', null, InputOption::VALUE_REQUIRED, 'Retention period in days', 30);
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $days = (int) $input->getOption('days');
        $cleaned = $this->uploadService->cleanupExpiredFiles($days);
        $output->writeln("Cleaned up {$cleaned} expired files.");
        return Command::SUCCESS;
    }
}