// src/users/users.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MeController } from './me.controller';
import { DatabaseModule } from '../../database/database.module';
import { SignalsModule } from '../signals/signals.module';
import { FavoritesModule } from '../favorites/favorites.module';
import { TradersModule } from '../traders/traders.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { EnvVars } from '../../config/env.validation';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => SignalsModule), // Circular dependency oldini olish
    FavoritesModule,
    TradersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get('JWT_EXPIRES_IN') || '7d',
        },
      }),
    }),
  ],
  controllers: [UsersController, MeController],
  providers: [UsersService, JwtAuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
