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

  console.log('📋 Allowed CORS Origins:', allowedOrigins);

  app.enableCors({
    origin: (origin, callback) => {
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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
