import { Test, TestingModule } from '@nestjs/testing';
import { ReadmeAgentController } from './readme-agent.controller';

describe('ReadmeAgentController', () => {
  let controller: ReadmeAgentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadmeAgentController],
    }).compile();

    controller = module.get<ReadmeAgentController>(ReadmeAgentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
