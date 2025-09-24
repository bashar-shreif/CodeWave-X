import { ApiProperty } from '@nestjs/swagger';

class ManifestEntryDto {
  @ApiProperty() path: string;
  @ApiProperty() size: number;
  @ApiProperty() hash: string;
}

class DepItemDto {
  @ApiProperty() name: string;
  @ApiProperty() version: string;
  @ApiProperty() type: string;
}

class PerManifestDto {
  @ApiProperty() manifestPath: string;
  @ApiProperty({ type: [DepItemDto] }) runtime: DepItemDto[];
  @ApiProperty({ type: [DepItemDto] }) dev: DepItemDto[];
  @ApiProperty({ type: [String] }) tools: string[];
  @ApiProperty({ type: [String] }) pkgManagers: string[];
  @ApiProperty({ type: Object }) scripts: Record<string, string>;
}

export class DepsRunResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: [ManifestEntryDto] }) manifest: ManifestEntryDto[];
  @ApiProperty({ type: [PerManifestDto] }) perManifest: PerManifestDto[];
  @ApiProperty({ type: [DepItemDto] }) result_runtime: DepItemDto[];
  @ApiProperty({ type: [DepItemDto] }) result_dev: DepItemDto[];
  @ApiProperty({ type: [String] }) result_tools: string[];
  @ApiProperty({ type: [String] }) result_pkgManagers: string[];
  @ApiProperty({ type: Object }) result_scripts: Record<string, string>;
  @ApiProperty({ type: [String] }) result_notes: string[];
}
