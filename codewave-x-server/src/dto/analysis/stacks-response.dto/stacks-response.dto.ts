import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubprojectStacksDto {
  @ApiProperty()
  name: string;

  @ApiProperty({
    description: 'Technology stacks - can be an array of strings or an object with boolean values',
    examples: [
      ['react', 'nodejs', 'typescript'],
      { react: true, nodejs: true, typescript: false }
    ]
  })
  stacks: string[] | Record<string, boolean>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Raw analysis data'
  })
  raw?: Record<string, any> | null;
}

export class StacksResultDto {
  @ApiProperty({ type: Boolean })
  isMonorepo: boolean;

  @ApiProperty({
    description: 'Aggregated technology stacks - can be an array of strings or an object with boolean values',
    examples: [
      ['react', 'nodejs', 'typescript'],
      { react: true, nodejs: true, typescript: false }
    ]
  })
  aggregated: string[] | Record<string, boolean>;

  @ApiPropertyOptional({
    type: [SubprojectStacksDto],
    description: 'Per-subproject stack information'
  })
  perSubproject?: SubprojectStacksDto[];
}

export class GetStacksResponseDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty({ enum: ['ok'] })
  status: 'ok';

  @ApiProperty({ type: Number })
  tookMs: number;

  @ApiProperty({ type: StacksResultDto })
  result: StacksResultDto;
}