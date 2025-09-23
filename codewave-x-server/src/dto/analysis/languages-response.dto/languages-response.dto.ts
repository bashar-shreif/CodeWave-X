import { ApiProperty } from '@nestjs/swagger';

export class LanguagesPerSubprojectDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  distribution: Record<string, number>;

  @ApiProperty({ type: 'object', additionalProperties: true })
  raw?: any;
}

export class LanguagesResultDto {
  @ApiProperty()
  isMonorepo: boolean;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  aggregated: Record<string, number>;

  @ApiProperty({ type: [LanguagesPerSubprojectDto], required: false })
  perSubproject?: LanguagesPerSubprojectDto[];
}

export class GetLanguagesResponseDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty()
  tookMs: number;

  @ApiProperty({ type: LanguagesResultDto })
  result: LanguagesResultDto;
}
