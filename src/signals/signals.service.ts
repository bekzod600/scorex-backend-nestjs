// src/signals/signals.service.ts
// YANGILANGAN - Results tab da signallar doimo ochiq

import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
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
      seller_scorex: 1000,
    });
    await this.activeSymbols.touch(dto.ticker, 'signal_created');

    return rows[0];
  }

  /**
   * List signals with optional tab filter and pagination
   */
  async list(
    viewerId?: string,
    params?: {
      tab?: 'live' | 'results';
      page?: number;
      limit?: number;
    },
  ) {
    const tab = params?.tab || 'live';
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build status filter based on tab
    let statusFilter = '';
    if (tab === 'live') {
      statusFilter = `WHERE s.status IN ('WAIT_EP', 'IN_TRADE')`;
    } else if (tab === 'results') {
      statusFilter = `WHERE s.status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')`;
    }

    const { rows } = await this.pool.query(
      `
      SELECT 
        s.*,
        u.telegram_username as trader_username,
        u.telegram_first_name as trader_display_name,
        u.avatar as trader_avatar,
        u.score_x as trader_score_x,
        EXISTS(
          SELECT 1 FROM signal_purchases p
          WHERE p.signal_id = s.id AND p.user_id = $1
        ) AS is_purchased
      FROM signals s
      LEFT JOIN users u ON u.id = s.seller_id
      ${statusFilter}
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [viewerId ?? null, limit, offset],
    );

    // Get total count
    const { rows: countRows } = await this.pool.query(
      `
      SELECT COUNT(*) as total
      FROM signals s
      ${statusFilter}
      `,
    );

    // MUHIM: tab parametrini formatSignalResponse ga uzatamiz
    const signals = rows.map((s) => this.formatSignalResponse(s, tab));

    return {
      signals,
      total: Number(countRows[0]?.total || 0),
      page,
      limit,
    };
  }

  /**
   * Find signal by ID with purchase access check
   */
  async findByIdWithAccess(id: string, viewerId?: string) {
    const { rows } = await this.pool.query(
      `
      SELECT 
        s.*,
        u.telegram_username as trader_username,
        u.telegram_first_name as trader_display_name,
        u.avatar as trader_avatar,
        u.score_x as trader_score_x,
        EXISTS(
          SELECT 1 FROM signal_purchases p
          WHERE p.signal_id = s.id AND p.user_id = $2
        ) AS is_purchased
      FROM signals s
      LEFT JOIN users u ON u.id = s.seller_id
      WHERE s.id = $1
      `,
      [id, viewerId ?? null],
    );

    if (!rows[0]) {
      throw new NotFoundException('Signal not found');
    }

    // Signal detail: yopilgan bo'lsa results sifatida format qilamiz
    const row = rows[0];
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      row.status,
    );
    const tab = isClosedStatus ? 'results' : 'live';

    return this.formatSignalResponse(row, tab);
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

  /**
   * Get user's own signals
   */
  async getMySignals(userId: string, params?: { tab?: 'live' | 'results' }) {
    const tab = params?.tab || 'live';

    let statusFilter = '';
    if (tab === 'live') {
      statusFilter = `AND s.status IN ('WAIT_EP', 'IN_TRADE')`;
    } else if (tab === 'results') {
      statusFilter = `AND s.status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')`;
    }

    const { rows } = await this.pool.query(
      `
      SELECT 
        s.*,
        u.telegram_username as trader_username,
        u.telegram_first_name as trader_display_name,
        u.avatar as trader_avatar,
        u.score_x as trader_score_x,
        TRUE AS is_purchased
      FROM signals s
      LEFT JOIN users u ON u.id = s.seller_id
      WHERE s.seller_id = $1
      ${statusFilter}
      ORDER BY s.created_at DESC
      `,
      [userId],
    );

    return {
      signals: rows.map((s) => this.formatSignalResponse(s, tab)),
      total: rows.length,
    };
  }

  /**
   * Format signal response for frontend
   * @param row - Database row
   * @param tab - Optional tab parameter ('live' | 'results')
   *              If 'results', signal is always unlocked (historical data)
   */
  private formatSignalResponse(row: any, tab?: 'live' | 'results') {
    const isPaid = row.access_type === 'PAID';
    const isPurchased = row.is_purchased === true;

    // MUHIM: Results tab da signallar doimo ochiq (tarixiy ma'lumot)
    // Yopilgan signallar (CLOSED_TP, CLOSED_SL, CANCELED) sotib olinishi shart emas
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      row.status,
    );
    const isLocked =
      isPaid && !isPurchased && !isClosedStatus && tab !== 'results';

    return {
      id: row.id,
      ticker: isLocked ? '********' : row.ticker,
      direction: row.direction || 'BUY',
      entry: isLocked ? null : Number(row.ep),
      ep: isLocked ? null : Number(row.ep),
      tp1: isLocked ? null : Number(row.tp1),
      tp2: row.tp2 ? (isLocked ? null : Number(row.tp2)) : null,
      sl: isLocked ? null : Number(row.sl),
      currentPrice: null,
      status: this.mapStatus(row.status),
      accessType: row.access_type,
      isFree: row.access_type === 'FREE',
      price: Number(row.price) || 0,
      discountPercent: 0,
      islamiclyStatus: row.islamicly_status,
      musaffaStatus: row.musaffa_status,
      isLocked,
      isPurchased,
      likes: 0,
      dislikes: 0,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      enteredAt: row.entered_at,
      trader: {
        id: row.seller_id,
        username: row.trader_username || 'Unknown',
        displayName: row.trader_display_name,
        avatar: row.trader_avatar,
        scoreXPoints: Number(row.trader_score_x) || 1000,
        rank: 0,
        avgStars: 0,
        totalPLPercent: 0,
        totalSignals: 0,
        subscribers: 0,
        avgDaysToResult: 0,
      },
    };
  }

  /**
   * Map backend status to frontend status
   */
  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      WAIT_EP: 'WAITING_ENTRY',
      IN_TRADE: 'ACTIVE',
      CLOSED_TP: 'TP1_HIT',
      CLOSED_SL: 'SL_HIT',
      CANCELED: 'CANCEL',
    };
    return statusMap[status] || status;
  }
}
