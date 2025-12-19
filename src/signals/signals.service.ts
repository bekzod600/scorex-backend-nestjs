import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateSignalDto } from './dto/create-signal.dto';
import { SignalStatus } from './constants/signal.constants';
import { FilterMatcherService } from 'src/filters/filter-matcher.service';
import { ActiveSymbolsService } from 'src/pricing/active-symbols.service';

@Injectable()
export class SignalsService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly filterMatcher: FilterMatcherService,
    private readonly activeSymbols: ActiveSymbolsService,
  ) {}

  async create(userId: string, dto: CreateSignalDto) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO signals (
        seller_id, ticker, access_type, price,
        ep, tp1, tp2, sl, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'WAIT_EP')
      RETURNING *
      `,
      [
        userId,
        dto.ticker,
        dto.accessType,
        dto.price ?? null,
        dto.ep,
        dto.tp1,
        dto.tp2 ?? null,
        dto.sl,
      ],
    );

    await this.filterMatcher.onNewSignal({
      ...rows[0],
      seller_scorex: 1000, // keyin join bilan olamiz
    });
    await this.activeSymbols.touch(dto.ticker, 'signal_created');

    return rows[0];
  }

  async list(viewerId?: string) {
    const { rows } = await this.pool.query(
      `
      SELECT s.*,
      EXISTS(
        SELECT 1 FROM signal_purchases p
        WHERE p.signal_id = s.id AND p.user_id = $1
      ) AS is_purchased
      FROM signals s
      ORDER BY s.created_at DESC
      `,
      [viewerId ?? null],
    );

    return rows.map((s) => ({
      ...s,
      isLocked: s.access_type === 'PAID' && !s.is_purchased,
      ticker:
        s.access_type === 'PAID' && !s.is_purchased ? '********' : s.ticker,
    }));
  }

  async findById(id: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM signals WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async updateStatus(id: string, status: SignalStatus) {
    const { rows } = await this.pool.query(
      `
      UPDATE signals
      SET status = $2,
          entered_at = CASE WHEN $2 = 'IN_TRADE' THEN NOW() ELSE entered_at END,
          closed_at  = CASE WHEN $2 IN ('CLOSED_TP','CLOSED_SL','CANCELED')
                            THEN NOW() ELSE closed_at END
      WHERE id = $1
      RETURNING *
      `,
      [id, status],
    );

    if (!rows[0]) {
      throw new BadRequestException('Signal not found');
    }

    return rows[0];
  }
}
