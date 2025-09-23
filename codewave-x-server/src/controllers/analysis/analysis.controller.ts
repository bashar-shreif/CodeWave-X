import { Controller, Get, HttpStatus, Param, Query, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { DepsRunResponseDto } from '../../dto/runtime/deps-run.dto';
import { StatsResponseDto } from 'src/dto/analysis/stats.dto/stats.dto';
import { GetFilesResponseDto } from 'src/dto/analysis/files-response.dto/files-response.dto';
import {
  GetStacksResponseDto,
  StacksResultDto,
} from 'src/dto/analysis/stacks-response.dto/stacks-response.dto';
import { ProjectParamDto } from 'src/dto/common/project-param/project-param.dto';
import {
  GetLanguagesResponseDto,
  LanguagesResultDto,
} from 'src/dto/analysis/languages-response.dto/languages-response.dto';
import { ArchitectureResponseDto } from 'src/dto/analysis/architecture-response.dto/architecture-response.dto';
import path from 'path';
import * as fs from 'fs';

@ApiTags('analysis')
@Controller('/v1/projects/:projectId')
export class AnalysisController {
  constructor(private readonly run: RunToolsService) {}

  @Get('deps')
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
          languages: {
            byLanguage: { typescript: 60, json: 20, md: 10, other: 10 },
          },
          manifests: 3,
          isMonorepo: true,
        },
      },
    },
  })
  async stats(
    @Param('projectId') projectId: string,
    @Query('force') force?: string,
  ): Promise<StatsResponseDto> {
    const t0 = Date.now();
    const out = await this.run.runStats({ projectId, force: force === 'true' });
    return { projectId, status: 'ok', tookMs: Date.now() - t0, result: out };
  }

  @Get('files')
  @ApiOperation({ summary: 'List files with size and hash' })
  @ApiParam({ name: 'projectId', required: true })
  @ApiOkResponse({
    schema: {
      allOf: [{ $ref: getSchemaPath(GetFilesResponseDto) }],
    },
    examples: {
      sample: {
        summary: 'ok',
        value: {
          projectId: 'job_001',
          status: 'ok',
          tookMs: 12,
          result: {
            totalFiles: 3,
            totalBytes: 12345,
            files: [
              { path: 'app/package.json', size: 512, hash: 'abc...' },
              { path: 'server/composer.json', size: 2048, hash: 'def...' },
            ],
            isMonorepo: false,
          },
        },
      },
    },
  })
  async getFiles(
    @Param('projectId') projectId: string,
  ): Promise<GetFilesResponseDto> {
    const t0 = Date.now();
    const result = await this.run.runFiles({ projectId });
    return {
      projectId,
      status: 'ok',
      tookMs: Date.now() - t0,
      result,
    };
  }

  @Get('stacks')
  @ApiOperation({ summary: 'Detect frameworks & platforms' })
  @ApiOkResponse({ type: GetStacksResponseDto })
  async getStacks(
    @Param() params: ProjectParamDto,
  ): Promise<GetStacksResponseDto> {
    const started = Date.now();
    const { projectId } = params;

    const data = await this.run.runStacks({ projectId });

    const result: StacksResultDto = {
      isMonorepo: data.isMonorepo,
      aggregated: data.aggregated,
      perSubproject: data.perSubproject?.map((p) => ({
        name: p.name,
        stacks: p.stacks,
        raw: p.raw,
      })),
    };

    return {
      projectId,
      status: 'ok',
      tookMs: Date.now() - started,
      result,
    };
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get language distribution' })
  @ApiOkResponse({ type: GetLanguagesResponseDto })
  async getLanguages(
    @Param('projectId') pid: string,
  ): Promise<GetLanguagesResponseDto> {
    const t0 = Date.now();
    const res = await this.run.runLanguages({ projectId: pid });
    const tookMs = Date.now() - t0;

    const isMono = !!res && Array.isArray((res as any).perSubproject);
    if (isMono) {
      const per = (res as any).perSubproject.map((p: any) => ({
        name: p.name,
        distribution: p.distribution ?? {},
      }));
      return {
        projectId: pid,
        status: 'ok',
        tookMs,
        result: {
          isMonorepo: true,
          aggregated: (res as any).aggregated ?? {},
          perSubproject: per,
        },
      };
    }

    return {
      projectId: pid,
      status: 'ok',
      tookMs,
      result: {
        isMonorepo: false,
        aggregated: (res as any)?.aggregated ?? {},
      },
    };
  }

  @Get('architecture')
  @ApiOperation({
    summary: 'Summarize architecture per subproject and aggregate',
  })
  @ApiOkResponse({
    type: ArchitectureResponseDto,
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 28,
        result: {
          isMonorepo: true,
          aggregated: {
            summaries: [
              'Modular NestJS backend with DI and modules',
              'React SPA with routing and API client',
            ],
            components: ['API', 'Auth', 'DB', 'UI', 'CLI'],
            patterns: ['Repository', 'Factory', 'Observer'],
          },
          perSubproject: [
            {
              name: 'api',
              summary: 'NestJS modular service exposing REST endpoints',
              components: ['API', 'Auth', 'DB'],
              patterns: ['Repository'],
            },
            {
              name: 'web',
              summary: 'React app with SPA routing',
              components: ['UI'],
              patterns: ['Observer'],
            },
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async architecture(@Param('projectId') projectId: string, @Res() res) {
    const started = Date.now();
    const rootBase =
      process.env.READMEA_WORKSPACES_ROOT ||
      path.join(__dirname, '..', 'workspaces');
    const repoRoot = path.join(rootBase, projectId);
    if (!fs.existsSync(repoRoot)) {
      return res.status(HttpStatus.NOT_FOUND).json({
        projectId,
        status: 'error',
        tookMs: Date.now() - started,
        error: 'not_found',
        message: 'Workspace not found',
        details: { repoRoot },
      });
    }
    const result = await this.run.runArchitecture(repoRoot);
    return res.status(HttpStatus.OK).json({
      projectId,
      status: 'ok',
      tookMs: Date.now() - started,
      result,
    });
  }
}
