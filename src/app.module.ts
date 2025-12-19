// src/app.module.ts
import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
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
  ],
})
export class AppModule {}
