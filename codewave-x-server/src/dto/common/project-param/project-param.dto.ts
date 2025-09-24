import { ApiProperty } from '@nestjs/swagger';

export class ProjectParamDto {
  @ApiProperty({ example: '4ccbe44bcc4c', minLength: 3 })
  projectId!: string;
}
