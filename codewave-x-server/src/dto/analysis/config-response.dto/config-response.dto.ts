// src/dto/analysis/config.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class ConfigEnvDto {
  @ApiProperty({ type: [String] }) files: string[];
  @ApiProperty({ type: [String] }) variables: string[];
}

export class ConfigSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: [String] }) bundlers: string[];
  @ApiProperty({ type: [String] }) cssTools: string[];
  @ApiProperty({ type: ConfigEnvDto }) env: ConfigEnvDto;
}

export class ConfigAggregatedDto {
  @ApiProperty({ type: [String] }) bundlers: string[];
  @ApiProperty({ type: [String] }) cssTools: string[];
  @ApiProperty({ type: ConfigEnvDto }) env: ConfigEnvDto;
}

export class ConfigResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: ConfigAggregatedDto }) aggregated: ConfigAggregatedDto;
  @ApiProperty({ type: [ConfigSubprojectDto] })
  perSubproject: ConfigSubprojectDto[];
}

export class ConfigResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: ConfigResultDto }) result: ConfigResultDto;
}
