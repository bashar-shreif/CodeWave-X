import { Test, TestingModule } from '@nestjs/testing';
import { ProjectPathService } from './project-path.service';

describe('ProjectPathService', () => {
  let service: ProjectPathService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectPathService],
    }).compile();

    service = module.get<ProjectPathService>(ProjectPathService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
