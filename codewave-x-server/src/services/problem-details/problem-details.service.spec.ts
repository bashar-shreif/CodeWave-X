import { Test, TestingModule } from '@nestjs/testing';
import { ProblemDetailsService } from './problem-details.service';

describe('ProblemDetailsService', () => {
  let service: ProblemDetailsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProblemDetailsService],
    }).compile();

    service = module.get<ProblemDetailsService>(ProblemDetailsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
