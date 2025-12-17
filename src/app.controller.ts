// src/health/health.controller.ts
import { Controller, Get, Inject } from '@nestjs/common';
import { Pool } from 'pg';

@Controller('health')
export class HealthController {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  @Get()
  async check() {
    const result = await this.pool.query('SELECT 1');

    return {
      status: 'ok',
      db: result.rowCount === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
    };
  }
}
