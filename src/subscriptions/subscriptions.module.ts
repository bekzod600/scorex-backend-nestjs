// src/subscriptions/subscriptions.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { DatabaseModule } from '../../database/database.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TradersModule } from '../traders/traders.module';
import type { EnvVars } from '../../config/env.validation';

@Module({
  imports: [
    DatabaseModule,
    TradersModule,
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
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, JwtAuthGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}

