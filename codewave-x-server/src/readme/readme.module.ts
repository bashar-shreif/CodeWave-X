import { Module } from '@nestjs/common';
import { ReadmeController } from './readme.controller';
import { ReadmeOrchestratorService } from '../orchestrator/readmeOrchestrator.service';

@Module({
  controllers: [ReadmeController],
  providers: [ReadmeOrchestratorService],
  exports: [ReadmeOrchestratorService],
})
export class ReadmeModule {}
