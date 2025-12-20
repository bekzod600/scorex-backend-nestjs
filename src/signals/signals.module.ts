import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SignalsService } from './signals.service';
import { SignalsController } from './signals.controller';
import { DatabaseModule } from '../../database/database.module';
import { RatingModule } from '../rating/rating.module';
import { FiltersModule } from 'src/filters/filters.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PricingModule } from 'src/pricing/pricing.module';
import { SignalEngineService } from './engine/signal-engine.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { EnvVars } from '../../config/env.validation';

@Module({
  imports: [
    DatabaseModule,
    RatingModule,
    FiltersModule,
    NotificationsModule,
    PricingModule,
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
  providers: [SignalsService, SignalEngineService, JwtAuthGuard],
  controllers: [SignalsController],
  exports: [SignalsService, SignalEngineService],
})
export class SignalsModule {}
