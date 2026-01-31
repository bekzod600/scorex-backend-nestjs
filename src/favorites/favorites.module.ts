// src/favorites/favorites.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { DatabaseModule } from '../../database/database.module';
import { SignalsModule } from '../signals/signals.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { EnvVars } from '../../config/env.validation';

@Module({
  imports: [
    DatabaseModule,
    SignalsModule,
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
  controllers: [FavoritesController],
  providers: [FavoritesService, JwtAuthGuard],
  exports: [FavoritesService],
})
export class FavoritesModule {}

