import { ApiProperty } from '@nestjs/swagger';

export class DocsSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [String] }) readmes: string[];
  @ApiProperty({ type: [String] }) docs: string[];
  @ApiProperty({ type: [String] }) topics: string[];
}

export class DocsAggregatedDto {
  @ApiProperty({ type: [String] }) readmes: string[];
  @ApiProperty({ type: [String] }) topics: string[];
  @ApiProperty() docsCount: number;
}

export class DocsResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: DocsAggregatedDto }) aggregated: DocsAggregatedDto;
  @ApiProperty({ type: [DocsSubprojectDto] })
  perSubproject: DocsSubprojectDto[];
}

export class DocsResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: DocsResultDto }) result: DocsResultDto;
}
