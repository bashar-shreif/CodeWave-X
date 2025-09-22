import { Module } from '@nestjs/common';
import { ReadmeController } from './readme/readme.controller';
import { ReadmeModule } from './readme/readme.module';

@Module({
  imports: [ReadmeModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
