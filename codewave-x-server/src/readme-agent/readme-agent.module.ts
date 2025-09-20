import { Module } from '@nestjs/common';
import { ReadmeAgentService } from './readme-agent.service';
import { ReadmeAgentController } from './readme-agent.controller';

@Module({
  providers: [ReadmeAgentService],
  controllers: [ReadmeAgentController]
})
export class ReadmeAgentModule {}
