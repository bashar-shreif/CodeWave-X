import { ApiProperty } from '@nestjs/swagger';

export class StatsResultDto {
  @ApiProperty() totalFiles: number;
  @ApiProperty() totalBytes: number;
  @ApiProperty({ type: Object }) languages: any;
  @ApiProperty() manifests: number;
  @ApiProperty() isMonorepo: boolean;
}

export class StatsResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty() status: 'ok';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: StatsResultDto }) result: StatsResultDto;
}
