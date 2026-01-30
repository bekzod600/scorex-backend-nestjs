// src/traders/traders.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TradersController } from './traders.controller';
import { TradersService } from './traders.service';
import { DatabaseModule } from '../../database/database.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { EnvVars } from '../../config/env.validation';

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
  controllers: [TradersController],
  providers: [TradersService, JwtAuthGuard],
  exports: [TradersService],
})
export class TradersModule {}
