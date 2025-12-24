import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { SignalEngineService } from '../signals/engine/signal-engine.service';
import { PricingService } from '../pricing/pricing.service';

@Injectable()
export class SignalEngineJob {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly engine: SignalEngineService,
    private readonly pricing: PricingService,
  ) {}

  async run() {
    const { rows } = await this.pool.query(
      `
      SELECT * FROM signals
      WHERE status IN ('WAIT_EP','IN_TRADE')
      `,
    );

    for (const s of rows) {
      const price = await this.pricing.getPrice(s.ticker);

      if (s.status === 'WAIT_EP' && price.price <= s.ep) {
        await this.engine.markEntered(s.id);
      }

      if (s.status === 'IN_TRADE') {
        if (price.price >= s.tp1) {
          await this.engine.markTp(s.id);
        }
        if (price.price <= s.sl) {
          await this.engine.markSl(s.id);
        }
      }
    }
  }
}
