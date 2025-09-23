import { Module } from '@nestjs/common';
import { AnalysisModule } from '../analysis/analysis.module';

@Module({
  imports: [AnalysisModule],
})
export class ApiModule {}
