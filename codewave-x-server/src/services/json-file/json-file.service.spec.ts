import { Test, TestingModule } from '@nestjs/testing';
import { JsonFileService } from './json-file.service';

describe('JsonFileService', () => {
  let service: JsonFileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JsonFileService],
    }).compile();

    service = module.get<JsonFileService>(JsonFileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
