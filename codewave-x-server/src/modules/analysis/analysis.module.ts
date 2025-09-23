import { Module } from '@nestjs/common';
import { AnalysisService } from '../../services/analysis/analysis.service';

@Module({
  providers: [AnalysisService]
})
export class AnalysisModule {}
