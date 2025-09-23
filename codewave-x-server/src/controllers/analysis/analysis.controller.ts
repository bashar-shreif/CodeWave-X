import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { RunToolsService } from '../../services/run-tools/run-tools.service';
import { DepsRunResponseDto } from '../../dto/runtime/deps-run.dto';

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
}
