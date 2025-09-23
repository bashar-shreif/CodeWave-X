import { Test, TestingModule } from '@nestjs/testing';
import { N8nBridgeService } from './n8n-bridge.service';

describe('N8nBridgeService', () => {
  let service: N8nBridgeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [N8nBridgeService],
    }).compile();

    service = module.get<N8nBridgeService>(N8nBridgeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
