import { ApiProperty } from '@nestjs/swagger';

export class FileEntryDto {
  @ApiProperty() path: string;
  @ApiProperty() size: number;
  @ApiProperty() hash: string;
}

export class PerSubprojectFilesDto {
  @ApiProperty() name: string;
  @ApiProperty() totalFiles: number;
  @ApiProperty() totalBytes: number;
  @ApiProperty({ type: [FileEntryDto] }) files: FileEntryDto[];
}

export class GetFilesResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty() status: 'ok';
  @ApiProperty() tookMs: number;
  @ApiProperty({
    type: 'object',
    properties: {
      totalFiles: { type: 'number' },
      totalBytes: { type: 'number' },
      files: { type: 'array', items: { $ref: '#/components/schemas/FileEntryDto' } },
      isMonorepo: { type: 'boolean' },
      perSubproject: { type: 'array', items: { $ref: '#/components/schemas/PerSubprojectFilesDto' } },
    },
  })
  result: {
    totalFiles: number;
    totalBytes: number;
    files: FileEntryDto[];
    isMonorepo: boolean;
    perSubproject?: PerSubprojectFilesDto[];
  };
}
