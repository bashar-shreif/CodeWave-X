import { ApiProperty } from '@nestjs/swagger';

class SecurityIssuesDto {
  @ApiProperty({ example: true }) envFilesPresent!: boolean;
  @ApiProperty({ example: true }) secretFilesDetected!: boolean;
  @ApiProperty({ example: 1 }) corsWildcardCount!: number;
  @ApiProperty({ example: 4 }) debugModeCount!: number;
  @ApiProperty({ example: 2 }) hardcodedKeysCount!: number;
  @ApiProperty({ example: 0 }) vulnerableDepsCount!: number;
}

class SecurityFilesDto {
  @ApiProperty({ type: [String], example: ['.env', 'apps/api/.env.local'] }) envFiles!: string[];
  @ApiProperty({ type: [String], example: ['certs/dev.key'] }) secretFiles!: string[];
  @ApiProperty({ type: [String], example: ['src/server.ts'] }) corsFiles!: string[];
  @ApiProperty({ type: [String], example: ['config/dev.php'] }) debugFiles!: string[];
  @ApiProperty({ type: [String], example: ['certs/dev.key'] }) keyFiles!: string[];
}

export class SecurityResponseDto {
  @ApiProperty() projectId!: string;
  @ApiProperty({ required: false }) generatedAt?: string;
  @ApiProperty({ example: 72 }) score!: number;
  @ApiProperty({ type: SecurityIssuesDto }) issues!: SecurityIssuesDto;
  @ApiProperty({ type: SecurityFilesDto }) files!: SecurityFilesDto;
  @ApiProperty({ type: [String], example: ['Review CORS origin'] }) notes!: string[];
  @ApiProperty() artifactsDir!: string;
}
