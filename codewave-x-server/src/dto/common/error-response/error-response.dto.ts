import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({ example: 'not_found' })
  error!: string;

  @ApiProperty({ example: 'Artifacts not found' })
  message!: string;

  @ApiProperty({ required: false, example: 'req_1234' })
  requestId?: string;

  @ApiProperty({ required: false, example: { projectId: '4ccbe44bcc4c' } })
  details?: Record<string, any>;
}
