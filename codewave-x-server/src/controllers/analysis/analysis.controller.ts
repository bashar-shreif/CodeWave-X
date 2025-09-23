import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnalysisService } from '../../services/analysis/analysis.service';
import { ProjectParamDto } from '../../dto/common/project-param/project-param.dto';
import { DepsResponseDto } from '../../dto/analysis/deps-response/deps-response.dto';
import { ErrorResponseDto } from '../../dto/common/error-response/error-response.dto';
import { SecurityResponseDto } from 'src/dto/analysis/security-response.dto/security-response.dto';

@ApiTags('Analysis')
@Controller('v1/projects')
export class AnalysisController {
  constructor(private readonly svc: AnalysisService) {}

  @Get(':projectId/deps')
  @ApiOperation({ summary: 'Get dependency summary for a project' })
  @ApiParam({
    name: 'projectId',
    schema: { type: 'string', minLength: 3 },
    example: '4ccbe44bcc4c',
  })
  @ApiOkResponse({
    type: DepsResponseDto,
    description: 'Dependency managers and packages',
    examples: {
      sample: {
        summary: 'Typical npm + composer project',
        value: {
          projectId: '4ccbe44bcc4c',
          generatedAt: '2025-09-23T05:40:00.000Z',
          managers: [
            {
              name: 'npm',
              lock: 'package-lock.json',
              dependencies: [
                { name: 'express', version: '^4.19.2', type: 'prod' },
                { name: 'jest', version: '^29.7.0', type: 'dev' },
              ],
            },
            {
              name: 'composer',
              lock: 'composer.lock',
              dependencies: [
                { name: 'laravel/framework', version: '10.*', type: 'prod' },
              ],
            },
          ],
          stats: { totalManagers: 2, totalDependencies: 3 },
          artifactsDir: 'artifacts/4ccbe44bcc4c',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Artifacts or deps.json not found',
    type: ErrorResponseDto,
  })
  async getDeps(@Param() params: ProjectParamDto): Promise<DepsResponseDto> {
    return this.svc.getDeps(params.projectId);
  }

  @Get(':projectId/security')
  @ApiOperation({ summary: 'Get security findings for a project' })
  @ApiParam({
    name: 'projectId',
    schema: { type: 'string', minLength: 3 },
    example: '4ccbe44bcc4c',
  })
  @ApiOkResponse({
    type: SecurityResponseDto,
    description: 'Static security signals and counts',
    examples: {
      sample: {
        summary: 'Mixed findings with counts',
        value: {
          projectId: '4ccbe44bcc4c',
          generatedAt: '2025-09-23T05:45:00.000Z',
          score: 72,
          issues: {
            envFilesPresent: true,
            secretFilesDetected: true,
            corsWildcardCount: 1,
            debugModeCount: 4,
            hardcodedKeysCount: 2,
            vulnerableDepsCount: 0,
          },
          files: {
            envFiles: ['.env', 'apps/api/.env.local'],
            secretFiles: ['certs/dev.key'],
            corsFiles: ['src/server.ts'],
            debugFiles: ['config/dev.php'],
            keyFiles: ['certs/dev.key'],
          },
          notes: ['Review CORS origin', 'Disable debug in production'],
          artifactsDir: 'artifacts/4ccbe44bcc4c',
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Artifacts or security.json not found',
    type: ErrorResponseDto,
  })
  async getSecurity(
    @Param() params: ProjectParamDto,
  ): Promise<SecurityResponseDto> {
    return this.svc.getSecurity(params.projectId);
  }
}
