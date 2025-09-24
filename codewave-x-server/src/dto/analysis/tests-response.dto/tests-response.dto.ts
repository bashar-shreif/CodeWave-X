import { ApiProperty } from '@nestjs/swagger';

export class TestsSubTotalsDto {
  @ApiProperty() count: number;
}

export class TestsSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [String] }) frameworks: string[];
  @ApiProperty({ type: TestsSubTotalsDto }) totals: TestsSubTotalsDto;
  @ApiProperty({ type: [String] }) files: string[];
}

export class TestsAggregatedDto {
  @ApiProperty() count: number;
  @ApiProperty({ type: [String] }) frameworks: string[];
}

export class TestsResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: TestsAggregatedDto }) aggregated: TestsAggregatedDto;
  @ApiProperty({ type: [TestsSubprojectDto] }) perSubproject: TestsSubprojectDto[];
}

export class TestsResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: TestsResultDto }) result: TestsResultDto;
}
