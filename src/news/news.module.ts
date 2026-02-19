import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { NewsService } from './news.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NewsController, AdminNewsController } from './news.controller';
import { DatabaseModule } from '../../database/database.module';
import type { EnvVars } from '../../config/env.validation';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
        },
      }),
    }),
  ],
  // imports: [DatabaseModule],
  controllers: [NewsController, AdminNewsController],
  providers: [NewsService, JwtAuthGuard],
  exports: [NewsService],
})
export class NewsModule {}
