import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateSignalDto } from './dto/create-signal.dto';
import { SignalStatus } from './constants/signal.constants';
import { FilterMatcherService } from 'src/filters/filter-matcher.service';
import { ActiveSymbolsService } from 'src/pricing/active-symbols.service';
import { PricingService } from 'src/pricing/pricing.service';

@Injectable()
export class SignalsService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly filterMatcher: FilterMatcherService,
    private readonly activeSymbols: ActiveSymbolsService,
    private readonly pricingService: PricingService,
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
      seller_scorex: 1000,
    });
    await this.activeSymbols.touch(dto.ticker, 'signal_created');

    return rows[0];
  }

  async list(viewerId?: string, tab: 'live' | 'results' = 'live') {
    // Determine status filter based on tab
    const statusFilter =
      tab === 'live'
        ? `s.status IN ('WAIT_EP', 'IN_TRADE')`
        : `s.status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')`;

    const { rows } = await this.pool.query(
      `
      SELECT 
        s.*,
        u.id as seller_id,
        u.email as seller_email,
        u.name as seller_name,
        u.score_x as seller_scorex,
        u.telegram_username as seller_telegram,
        EXISTS(
          SELECT 1 FROM signal_purchases p
          WHERE p.signal_id = s.id AND p.user_id = $1
        ) AS is_purchased,
        (
          SELECT COUNT(*) FROM signal_purchases p2
          WHERE p2.signal_id = s.id
        ) AS purchase_count
      FROM signals s
      LEFT JOIN users u ON s.seller_id = u.id
      WHERE ${statusFilter}
      ORDER BY s.created_at DESC
      `,
      [viewerId ?? null],
    );

    // Map signals to frontend format
    const signals = await Promise.all(
      rows.map(async (s) => {
        const isFree = s.access_type === 'FREE';
        const isPurchased = Boolean(s.is_purchased);
        const isLocked = !isFree && !isPurchased;

        // Get current price if ticker is available
        let currentPrice = 0;
        if (!isLocked && s.ticker) {
          try {
            const priceData = await this.pricingService.getPrice(s.ticker);
            currentPrice = priceData.price;
          } catch (err) {
            console.log(err);
            // Ignore price fetch errors
            currentPrice = 0;
          }
        }

        return {
          id: s.id,
          ticker: isLocked ? null : s.ticker,
          entry: isLocked ? null : Number(s.ep),
          tp1: isLocked ? null : Number(s.tp1),
          tp2: isLocked ? null : s.tp2 ? Number(s.tp2) : null,
          sl: isLocked ? null : Number(s.sl),
          currentPrice,
          status: this.mapStatus(s.status),
          isFree,
          price: Number(s.price) || 0,
          discountPercent: 0, // TODO: implement discount logic
          islamiclyStatus: this.mapComplianceStatus(s.islamicly_status),
          musaffaStatus: this.mapComplianceStatus(s.musaffa_status),
          trader: {
            id: s.seller_id,
            username:
              s.seller_telegram ||
              s.seller_name ||
              s.seller_email?.split('@')[0] ||
              'Trader',
            avatar: '', // TODO: implement avatar logic
            scoreXPoints: Number(s.seller_scorex) || 1000,
            rank: 0, // TODO: calculate rank
            avgStars: 0, // TODO: calculate from ratings
            totalPLPercent: 0, // TODO: calculate from closed signals
            totalSignals: 0, // TODO: count seller's signals
            subscribers: Number(s.purchase_count) || 0,
            avgDaysToResult: 0, // TODO: calculate average
          },
          likes: 0, // TODO: implement likes system
          dislikes: 0, // TODO: implement dislikes system
          createdAt: s.created_at,
          closedAt: s.closed_at || null,
          isLocked,
          isPurchased,
        };
      }),
    );

    return {
      signals,
      total: signals.length,
      page: 1,
      limit: 100,
    };
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

  // Helper method to map backend status to frontend status
  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      WAIT_EP: 'WAITING_ENTRY',
      IN_TRADE: 'ACTIVE',
      CLOSED_TP: 'TP1_HIT', // or TP2_HIT based on which TP was hit
      CLOSED_SL: 'SL_HIT',
      CANCELED: 'CANCEL',
    };
    return statusMap[status] || 'WAITING_ENTRY';
  }

  // Helper method to map compliance status
  private mapComplianceStatus(
    status: string | null,
  ): 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_COVERED' {
    if (!status) return 'NOT_COVERED';
    const normalized = status.toUpperCase();
    if (normalized === 'COMPLIANT') return 'COMPLIANT';
    if (normalized === 'NON_COMPLIANT') return 'NON_COMPLIANT';
    return 'NOT_COVERED';
  }
}
