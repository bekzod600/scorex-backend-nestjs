import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class ActiveSymbolsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async touch(symbol: string, reason = 'signal') {
    await this.pool.query(
      `
      INSERT INTO active_symbols (symbol, last_needed_at, reason)
      VALUES ($1, NOW(), $2)
      ON CONFLICT (symbol)
      DO UPDATE SET last_needed_at = NOW()
      `,
      [symbol, reason],
    );
  }

  async list(limit = 20) {
    const { rows } = await this.pool.query(
      `
      SELECT symbol
      FROM active_symbols
      ORDER BY priority_score DESC, last_needed_at DESC
      LIMIT $1
      `,
      [limit],
    );
    return rows.map((r) => r.symbol);
  }
}
