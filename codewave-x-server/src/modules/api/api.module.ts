import { Module } from '@nestjs/common';
import { AnalysisController } from '../../controllers/analysis/analysis.controller';
import { ProjectPathService } from '../../services/project-path/project-path.service';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { ManifestDiscoveryService } from '../../services/manifest-discovery/manifest-discovery.service';
import { AnalysisModule } from '../analysis/analysis.module';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [AnalysisModule, SecurityModule]
})
export class ApiModule {}
