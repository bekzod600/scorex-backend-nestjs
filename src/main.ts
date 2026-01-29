import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { Pool } from 'pg';
import type { EnvVars } from '../config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<EnvVars, true>);
  const nodeEnv = config.get('NODE_ENV', { infer: true });

  // Parse CORS origins from environment variable
  const corsOriginsString = config.get('CORS_ORIGINS', { infer: true });
  const allowedOrigins = corsOriginsString
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Security check: prevent wildcard in production
  if (nodeEnv === 'production' && allowedOrigins.includes('*')) {
    throw new Error(
      '🚨 SECURITY ERROR: Wildcard (*) CORS is not allowed in production! ' +
        'Please set specific domains in CORS_ORIGINS environment variable.',
    );
  }

  console.log('📋 Allowed CORS Origins:', allowedOrigins);

  app.enableCors({
    origin: (origin, callback) => {
      // Check if wildcard (*) is enabled - DEVELOPMENT ONLY!
      if (allowedOrigins.includes('*')) {
        console.warn(
          '⚠️  CORS: Wildcard (*) enabled - NOT SECURE FOR PRODUCTION!',
        );
        return callback(null, true);
      }

      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'ngrok-skip-browser-warning', // Allow ngrok bypass header
    ],
    exposedHeaders: ['Content-Length', 'X-Request-Id'],
    credentials: true,
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const pool = app.get<Pool>('PG_POOL');
  app.useGlobalInterceptors(new AuditInterceptor(pool));

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`🚀 Server: http://localhost:${port}`);
  console.log(`🌍 Environment: ${nodeEnv}`);
}

void bootstrap();
