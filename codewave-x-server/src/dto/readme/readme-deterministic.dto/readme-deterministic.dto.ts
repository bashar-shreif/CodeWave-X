import { ApiProperty } from '@nestjs/swagger';

export class ReadmeNoLlmResultDto {
  @ApiProperty() text: string;
  @ApiProperty() length: number;
}

export class ReadmeNoLlmResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: ReadmeNoLlmResultDto }) result: ReadmeNoLlmResultDto;
}
