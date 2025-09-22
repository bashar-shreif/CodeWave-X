import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ReadmeController } from './readme/readme.controller';
import { ReadmeModule } from './readme/readme.module';

@Module({
  imports: [ReadmeModule],
  controllers: [AppController, ReadmeController],
  providers: [AppService],
})
export class AppModule {}
