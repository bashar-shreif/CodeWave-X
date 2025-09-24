import { ApiProperty } from '@nestjs/swagger';

export class StacksPerSubprojectDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: [String] })
  stacks: string[];
}

export class StacksResultDto {
  @ApiProperty()
  isMonorepo: boolean;

  @ApiProperty({ type: [String] })
  aggregated: string[];

  @ApiProperty({ type: [StacksPerSubprojectDto], required: false })
  perSubproject?: StacksPerSubprojectDto[];
}

export class GetStacksResponseDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  status: 'ok';

  @ApiProperty()
  tookMs: number;

  @ApiProperty({ type: StacksResultDto })
  result: StacksResultDto;
}
