// src/training-centers/training-centers.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TrainingCentersService } from './training-centers.service';
import {
  TrainingCentersController,
  AdminTrainingCentersController,
} from './training-centers.controller';
import { DatabaseModule } from '../../database/database.module';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../common/guards/jwt-auth.guard';
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
  controllers: [TrainingCentersController, AdminTrainingCentersController],
  providers: [TrainingCentersService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [TrainingCentersService],
})
export class TrainingCentersModule {}
