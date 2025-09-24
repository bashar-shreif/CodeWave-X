import { Module } from '@nestjs/common';
import { SecurityController } from '../../controllers/security/security.controller';
import { RunToolsModule } from '../run-tools/run-tools.module';

@Module({
  imports: [RunToolsModule],
  controllers: [SecurityController],
})
export class SecurityModule {}
