import { Module } from '@nestjs/common';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { ManifestDiscoveryService } from '../../services/manifest-discovery/manifest-discovery.service';
import { ProjectPathService } from '../../services/project-path/project-path.service';

@Module({
  providers: [RunToolsService, ManifestDiscoveryService, ProjectPathService],
  exports: [RunToolsService],
})
export class RunToolsModule {}
