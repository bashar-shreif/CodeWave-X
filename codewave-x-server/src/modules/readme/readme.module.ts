import { Module } from '@nestjs/common';
import { ReadmeController } from '../../controllers/readme/readme.controller';
import { ReadmeOrchestratorService } from '../../services/orchestrator/readmeOrchestrator.service';

@Module({
  controllers: [ReadmeController],
  providers: [ReadmeOrchestratorService],
  exports: [ReadmeOrchestratorService],
})
export class ReadmeModule {}
