import { Module } from '@nestjs/common';
import { ReadmeModule } from './readme/readme.module';
import { AnalysisController } from './controllers/analysis/analysis.controller';
import { ApiModule } from './modules/api/api.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { SwaggerModule } from './modules/swagger/swagger.module';
import { N8nBridgeService } from './services/n8n-bridge/n8n-bridge.service';
import { ProjectPathService } from './services/project-path/project-path.service';
import { JsonFileService } from './services/json-file/json-file.service';
import { ProblemDetailsService } from './services/problem-details/problem-details.service';

@Module({
  imports: [ReadmeModule, ApiModule, AnalysisModule, SwaggerModule],
  controllers: [AnalysisController],
  providers: [N8nBridgeService, ProjectPathService, JsonFileService, ProblemDetailsService],
})
export class AppModule {}
