import { ApiProperty } from '@nestjs/swagger';

export class ArchitectureSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty() summary: string;
  @ApiProperty({ type: [String] }) components: string[];
  @ApiProperty({ type: [String] }) patterns: string[];
}

export class ArchitectureAggregatedDto {
  @ApiProperty({ type: [String] }) summaries: string[];
  @ApiProperty({ type: [String] }) components: string[];
  @ApiProperty({ type: [String] }) patterns: string[];
}

export class ArchitectureResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: ArchitectureAggregatedDto }) aggregated: ArchitectureAggregatedDto;
  @ApiProperty({ type: [ArchitectureSubprojectDto] }) perSubproject: ArchitectureSubprojectDto[];
}

export class ArchitectureResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: ArchitectureResultDto }) result: ArchitectureResultDto;
}
