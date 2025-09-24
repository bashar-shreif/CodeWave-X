import { ApiProperty } from '@nestjs/swagger';

export class RouteItemDto {
  @ApiProperty() type: 'api' | 'web';
  @ApiProperty() method: string;
  @ApiProperty() path: string;
  @ApiProperty() source: string;
}

export class RoutesSubTotalsDto {
  @ApiProperty() count: number;
  @ApiProperty({ type: [String] }) httpMethods: string[];
}

export class RoutesSubprojectDto {
  @ApiProperty() name: string;
  @ApiProperty({ type: RoutesSubTotalsDto }) totals: RoutesSubTotalsDto;
  @ApiProperty({ type: [RouteItemDto] }) routes: RouteItemDto[];
}

export class RoutesAggregatedDto {
  @ApiProperty() count: number;
  @ApiProperty({ type: [String] }) httpMethods: string[];
  @ApiProperty() apiCount: number;
  @ApiProperty() webCount: number;
}

export class RoutesResultDto {
  @ApiProperty() isMonorepo: boolean;
  @ApiProperty({ type: RoutesAggregatedDto }) aggregated: RoutesAggregatedDto;
  @ApiProperty({ type: [RoutesSubprojectDto] })
  perSubproject: RoutesSubprojectDto[];
}

export class RoutesResponseDto {
  @ApiProperty() projectId: string;
  @ApiProperty({ enum: ['ok', 'error'] }) status: 'ok' | 'error';
  @ApiProperty() tookMs: number;
  @ApiProperty({ type: RoutesResultDto }) result: RoutesResultDto;
}
