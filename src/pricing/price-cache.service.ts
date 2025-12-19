import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class PriceCacheService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async get(symbol: string) {
    const { rows } = await this.pool.query(
      `
      SELECT price, currency, fetched_at
      FROM price_cache
      WHERE symbol = $1
      `,
      [symbol],
    );
    return rows[0] ?? null;
  }

  async upsert(
    symbol: string,
    price: number,
    currency: string,
    marketTime?: Date,
  ) {
    await this.pool.query(
      `
      INSERT INTO price_cache (symbol, price, currency, market_time, fetched_at)
      VALUES ($1,$2,$3,$4,NOW())
      ON CONFLICT (symbol)
      DO UPDATE SET
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        market_time = EXCLUDED.market_time,
        fetched_at = NOW()
      `,
      [symbol, price, currency, marketTime ?? null],
    );
  }
}
