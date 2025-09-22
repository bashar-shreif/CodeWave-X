import { Module } from '@nestjs/common';
import { ReadmeModule } from './readme/readme.module';

@Module({
  imports: [ReadmeModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
