import { Module } from '@nestjs/common';
import { AnalysisController } from '../../controllers/analysis/analysis.controller';
import { ProjectPathService } from '../../services/project-path/project-path.service';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { ManifestDiscoveryService } from '../../services/manifest-discovery/manifest-discovery.service';

@Module({
  controllers: [AnalysisController],
  providers: [ProjectPathService, RunToolsService, ManifestDiscoveryService],
  exports: [ProjectPathService, RunToolsService, ManifestDiscoveryService],
})
export class ApiModule {}
