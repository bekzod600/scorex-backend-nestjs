// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WalletModule,
  ],
})
export class AppModule {}
