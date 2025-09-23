import { Module } from '@nestjs/common';
import { AnalysisController } from '../../controllers/analysis/analysis.controller';
import { AnalysisService } from '../../services/analysis/analysis.service';
import { ProjectPathService } from '../../services/project-path/project-path.service';
import { JsonFileService } from '../../services/json-file/json-file.service';

@Module({
  controllers: [AnalysisController],
  providers: [AnalysisService, ProjectPathService, JsonFileService],
  exports: [AnalysisService],
})
export class AnalysisModule {}
