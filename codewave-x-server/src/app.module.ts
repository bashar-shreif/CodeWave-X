import { Module } from '@nestjs/common';
import { ApiModule } from './modules/api/api.module';
import { SecurityController } from './controllers/security/security.controller';
import { SecurityModule } from './modules/security/security.module';
import { RunToolsModule } from './modules/run-tools/run-tools.module';

@Module({
  imports: [ApiModule, SecurityModule, RunToolsModule],
  controllers: [SecurityController],
})
export class AppModule {}
