import { Test, TestingModule } from '@nestjs/testing';
import { ReadmeController } from './readme.controller';

describe('ReadmeController', () => {
  let controller: ReadmeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReadmeController],
    }).compile();

    controller = module.get<ReadmeController>(ReadmeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
