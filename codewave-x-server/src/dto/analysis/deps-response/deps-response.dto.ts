import { ApiProperty } from '@nestjs/swagger';

class DependencyDto {
  @ApiProperty() name!: string;
  @ApiProperty() version!: string;
  @ApiProperty({ enum: ['prod', 'dev', 'peer', 'optional'], required: false })
  type?: string;
}

class DepManagerDto {
  @ApiProperty({ example: 'npm' }) name!: string;
  @ApiProperty({ required: false, example: 'package-lock.json' }) lock?: string;
  @ApiProperty({ type: [DependencyDto] }) dependencies!: DependencyDto[];
}

class DepsStatsDto {
  @ApiProperty() totalManagers!: number;
  @ApiProperty() totalDependencies!: number;
}

export class DepsResponseDto {
  @ApiProperty({ example: '4ccbe44bcc4c' }) projectId!: string;
  @ApiProperty({ example: '2025-09-23T05:40:00.000Z', required: false })
  generatedAt?: string;
  @ApiProperty({ type: [DepManagerDto] }) managers!: DepManagerDto[];
  @ApiProperty({ type: DepsStatsDto }) stats!: DepsStatsDto;
  @ApiProperty({ example: 'artifacts/4ccbe44bcc4c' }) artifactsDir!: string;
}
