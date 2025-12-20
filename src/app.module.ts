// src/app.module.ts
import { MiddlewareConsumer, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { SignalsModule } from './signals/signals.module';
import { PurchasesModule } from './purchases/purchases.module';
import { RatingModule } from './rating/rating.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FiltersModule } from './filters/filters.module';
import { PricingModule } from './pricing/pricing.module';
import { AdminModule } from './admin/admin.module';

import { WinstonModule } from 'nest-winston';
import { winstonConfig } from './common/logger/winston.config';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RequestLoggerMiddleware } from './common/middlewares/request-logger.middleware';
import { TelegramModule } from './telegram/telegram.module';
import { JobsModule } from './jobs/jobs.module';
// import { RedisModule } from './redis/redis.module';
// import Redis from 'ioredis';
// import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';

@Module({
  imports: [
    // ThrottlerModule.forRootAsync({
    //   inject: ['REDIS'],
    //   useFactory: (redis: Redis) => ({
    //     throttlers: [{ ttl: 60, limit: 100 }],
    //     storage: new RedisThrottlerStorage(redis),
    //   }),
    // }),
    ThrottlerModule.forRoot([
      {
        ttl: 60,
        limit: 100,
      },
    ]),
    WinstonModule.forRoot(winstonConfig),
    ConfigModule,
    DatabaseModule,
    // RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WalletModule,
    SignalsModule,
    PurchasesModule,
    RatingModule,
    NotificationsModule,
    FiltersModule,
    PricingModule,
    AdminModule,
    TelegramModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard, // Applies the guard to all routes
    },
  ],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
