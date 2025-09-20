import { Test, TestingModule } from '@nestjs/testing';
import { ReadmeAgentService } from './readme-agent.service';

describe('ReadmeAgentService', () => {
  let service: ReadmeAgentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReadmeAgentService],
    }).compile();

    service = module.get<ReadmeAgentService>(ReadmeAgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
