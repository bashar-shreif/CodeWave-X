import { Module } from '@nestjs/common';
import { AnalysisController } from '../../controllers/analysis/analysis.controller';
import { RunToolsModule } from '../run-tools/run-tools.module';

@Module({
  imports: [RunToolsModule],
  controllers: [AnalysisController],
})
export class AnalysisModule {}
