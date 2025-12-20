import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { Pool } from 'pg';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const pool = app.get<Pool>('PG_POOL');
  app.useGlobalInterceptors(new AuditInterceptor(pool));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
