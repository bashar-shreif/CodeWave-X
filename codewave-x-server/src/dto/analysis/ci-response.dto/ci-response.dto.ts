// src/dto/analysis/ci.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CiWorkflowDto {
  @ApiProperty() name: string;
  @ApiProperty() path: string;
  @ApiProperty({ type: [String] }) triggers: string[];
  @ApiProperty({ type: [String] }) jobs: string[];
}

export class CiSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [String] }) providers: string[];
  @ApiProperty({ type: [CiWorkflowDto] }) workflows: CiWorkflowDto[];
}

export class CiAggregatedDto {
  @ApiProperty({ type: [String] }) providers: string[];
  @ApiProperty() workflowsCount: number;
}

export class CiResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: CiAggregatedDto }) aggregated: CiAggregatedDto;
  @ApiProperty({ type: [CiSubprojectDto] }) perSubproject: CiSubprojectDto[];
}

export class CiResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: CiResultDto }) result: CiResultDto;
}
