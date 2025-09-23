import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { DepsRunResponseDto } from '../../dto/runtime/deps-run.dto';
import { StatsResponseDto } from 'src/dto/analysis/stats.dto/stats.dto';

@ApiTags('analysis')
@Controller('/v1/projects')
export class AnalysisController {
  constructor(private readonly run: RunToolsService) {}

  @Get(':projectId/deps')
  @ApiOperation({ summary: 'Run dependency analysis tool' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiOkResponse({ type: DepsRunResponseDto })
  async getDeps(
    @Param('projectId') projectId: string,
  ): Promise<DepsRunResponseDto> {
    return this.run.runDeps(projectId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get repository stats' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiQuery({ name: 'force', required: false, type: Boolean })
  @ApiOkResponse({
    type: StatsResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 12,
        result: {
          totalFiles: 128,
          totalBytes: 345678,
          languages: { byLanguage: { typescript: 60, json: 20, md: 10, other: 10 } },
          manifests: 3,
          isMonorepo: true
        }
      }
    }
  })
  async stats(
    @Param('projectId') projectId: string,
    @Query('force') force?: string,
  ): Promise<StatsResponseDto> {
    const t0 = Date.now();
    const out = await this.run.runStats({ projectId, force: force === 'true' });
    return { projectId, status: 'ok', tookMs: Date.now() - t0, result: out };
  }
}
