// src/database/database.module.ts
import { Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ConfigService } from '@nestjs/config';
import type { EnvVars } from '../config/env.validation';

@Module({
  providers: [
    {
      provide: 'PG_POOL',
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvVars, true>): Pool =>
        // We trust the `pg` Pool constructor here as an external, well-typed boundary.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        new Pool({
          host: config.get('DB_HOST', { infer: true }),
          port: Number(config.get('DB_PORT', { infer: true })),
          database: config.get('DB_NAME', { infer: true }),
          user: config.get('DB_USER', { infer: true }),
          password: config.get('DB_PASSWORD', { infer: true }),
        }),
    },
  ],
  exports: ['PG_POOL'],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async onModuleDestroy() {
    // We know `pool` is a `pg` Pool instance here.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    await this.pool.end();
  }
}
