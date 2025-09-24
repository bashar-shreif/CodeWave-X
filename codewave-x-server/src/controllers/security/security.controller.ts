import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RunToolsService } from '../../services/run-tools/run-tools.service';

@ApiTags('security')
@Controller('v1/projects/:projectId/security')
export class SecurityController {
  constructor(private readonly runner: RunToolsService) {}

  @Get()
  @ApiOperation({
    summary: 'Run security analysis per subproject and aggregate',
  })
  @ApiParam({ name: 'projectId', required: true })
  @ApiOkResponse({
    description: 'Security result',
    schema: {
      example: {
        projectId: 'job_001',
        status: 'ok',
        tookMs: 1234,
        targets: [
          {
            root: '.',
            result: {
              score: 42,
              issues: {
                envFilesPresent: true,
                secretFilesDetected: false,
                corsWildcardCount: 1,
                debugModeCount: 0,
                hardcodedKeysCount: 0,
                vulnerableDepsCount: 0,
              },
              files: {
                envFiles: ['.env'],
                secretFiles: [],
                corsFiles: ['src/main.ts'],
                debugFiles: [],
                keyFiles: [],
              },
              notes: [],
            },
          },
          {
            root: 'apps/web',
            result: {
              score: 10,
              issues: {
                envFilesPresent: false,
                secretFilesDetected: false,
                corsWildcardCount: 0,
                debugModeCount: 0,
                hardcodedKeysCount: 0,
                vulnerableDepsCount: 0,
              },
              files: {
                envFiles: [],
                secretFiles: [],
                corsFiles: [],
                debugFiles: [],
                keyFiles: [],
              },
              notes: [],
            },
          },
        ],
        aggregate: {
          scoreMax: 42,
          scoreAvg: 26,
          totals: {
            corsWildcardCount: 1,
            debugModeCount: 0,
            hardcodedKeysCount: 0,
            vulnerableDepsCount: 0,
          },
          flags: {
            envFilesPresent: true,
            secretFilesDetected: false,
          },
        },
      },
    },
  })
  async getSecurity(@Param('projectId') projectId: string) {
    return this.runner.runSecurity(projectId);
  }
}
