// src/signals/signals.service.ts
// YANGILANGAN - Subscription-based locking logic

import {
  Inject,
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { CreateSignalDto } from './dto/create-signal.dto';
import { SignalStatus } from './constants/signal.constants';
import { FilterMatcherService } from 'src/filters/filter-matcher.service';
import { ActiveSymbolsService } from 'src/pricing/active-symbols.service';

/**
 * YANGI LOCKING MANTIQ:
 *
 * | Foydalanuvchi               | FREE signallar | PAID signallar          |
 * |-----------------------------|----------------|-------------------------|
 * | role='admin'                | 🔓 UNLOCKED    | 🔓 UNLOCKED             |
 * | Premium subscriber (faol)  | 🔓 UNLOCKED    | 🔒 LOCKED (sotib olish) |
 * | Oddiy user (free)          | 🔒 LOCKED      | 🔒 LOCKED               |
 * | Results tab (yopilgan)     | 🔓 UNLOCKED    | 🔓 UNLOCKED             |
 *
 * Signal egasi (seller) - o'z signallari doimo ochiq
 * Sotib olingan signallar - doimo ochiq
 */

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
   * List signals with subscription-aware locking
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

    let statusFilter = '';
    if (tab === 'live') {
      statusFilter = `WHERE s.status IN ('WAIT_EP', 'IN_TRADE')`;
    } else if (tab === 'results') {
      statusFilter = `WHERE s.status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')`;
    }

    // Get viewer's access level
    const viewerAccess = await this.getViewerAccess(viewerId);

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

    const { rows: countRows } = await this.pool.query(
      `SELECT COUNT(*) as total FROM signals s ${statusFilter}`,
    );

    const signals = rows.map((s) =>
      this.formatSignalResponse(s, viewerAccess, tab),
    );

    return {
      signals,
      total: Number(countRows[0]?.total || 0),
      page,
      limit,
    };
  }

  /**
   * Find signal by ID with subscription-aware locking
   */
  async findByIdWithAccess(id: string, viewerId?: string) {
    const viewerAccess = await this.getViewerAccess(viewerId);

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

    const row = rows[0];
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      row.status,
    );
    const tab = isClosedStatus ? 'results' : 'live';

    return this.formatSignalResponse(row, viewerAccess, tab);
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
   * Get user's own signals (always unlocked)
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

    // Own signals are always unlocked
    const ownerAccess = { isAdmin: true, hasPremium: true, userId };

    return {
      signals: rows.map((s) => this.formatSignalResponse(s, ownerAccess, tab)),
      total: rows.length,
    };
  }

  /**
   * Cancel signal — only the owner can cancel
   * POST /me/signals/:id/cancel
   */
  async cancelOwnSignal(userId: string, signalId: string) {
    const { rows } = await this.pool.query(
      `SELECT id, seller_id, status FROM signals WHERE id = $1 LIMIT 1`,
      [signalId],
    );

    if (!rows[0]) {
      throw new NotFoundException('Signal not found');
    }

    if ((rows[0].seller_id as string) !== userId) {
      throw new ForbiddenException('You can only cancel your own signals');
    }

    const nonCancellable = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'];
    if (nonCancellable.includes(rows[0].status as string)) {
      throw new BadRequestException(
        `Cannot cancel a signal with status: ${rows[0].status}`,
      );
    }

    const { rows: updated } = await this.pool.query(
      `UPDATE signals
       SET status = 'CANCELED', closed_at = NOW()
       WHERE id = $1
       RETURNING id, status`,
      [signalId],
    );

    return {
      success: true,
      signal: { id: updated[0].id, status: updated[0].status },
    };
  }

  // ============================================
  // ACCESS CONTROL
  // ============================================

  /**
   * Get viewer's access level
   */
  private async getViewerAccess(viewerId?: string): Promise<{
    isAdmin: boolean;
    hasPremium: boolean;
    userId: string | null;
  }> {
    if (!viewerId) {
      return { isAdmin: false, hasPremium: false, userId: null };
    }

    const { rows } = await this.pool.query(
      `
      SELECT 
        id,
        role,
        subscription_plan,
        subscription_expires_at
      FROM users
      WHERE id = $1
      `,
      [viewerId],
    );

    if (!rows[0]) {
      return { isAdmin: false, hasPremium: false, userId: null };
    }

    const user = rows[0];
    const isAdmin = user.role === 'admin';
    const hasPremium =
      user.subscription_plan === 'premium' &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date();

    return { isAdmin, hasPremium, userId: user.id };
  }

  /**
   * Calculate if signal should be locked
   *
   * MANTIQ:
   * 1. Admin - hamma narsa ochiq
   * 2. Signal egasi - o'z signallari ochiq
   * 3. Sotib olingan - ochiq
   * 4. Results tab (yopilgan) - ochiq
   * 5. FREE signal + Premium subscriber - ochiq
   * 6. Boshqa hollarda - yopiq
   */
  private calculateIsLocked(
    row: any,
    viewerAccess: {
      isAdmin: boolean;
      hasPremium: boolean;
      userId: string | null;
    },
    tab?: 'live' | 'results',
  ): boolean {
    const isFree = row.access_type === 'FREE';
    const isPurchased = row.is_purchased === true;
    const isOwner =
      viewerAccess.userId && row.seller_id === viewerAccess.userId;
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      row.status,
    );

    // 1. Admin - barcha signallar ochiq
    if (viewerAccess.isAdmin) {
      return false;
    }

    // 2. Signal egasi - o'z signallari ochiq
    if (isOwner) {
      return false;
    }

    // 3. Sotib olingan signal - ochiq
    if (isPurchased) {
      return false;
    }

    // 4. Results tab (yopilgan signallar) - tarixiy ma'lumot, ochiq
    if (isClosedStatus || tab === 'results') {
      return false;
    }

    // 5. FREE signal + Premium subscriber - ochiq
    if (isFree && viewerAccess.hasPremium) {
      return false;
    }

    // 6. Boshqa hollarda - yopiq
    // FREE signal lekin premium yo'q - YOPIQ
    // PAID signal lekin sotib olinmagan - YOPIQ
    return true;
  }

  // ============================================
  // CALCULATIONS
  // ============================================

  private calculatePotentialProfit(ep: number, tp1: number): number {
    if (!ep || ep <= 0 || !tp1) return 0;
    return Number((((tp1 - ep) / ep) * 100).toFixed(2));
  }

  private calculatePotentialLoss(ep: number, sl: number): number {
    if (!ep || ep <= 0 || !sl) return 0;
    return Number((((ep - sl) / ep) * 100).toFixed(2));
  }

  private calculateRiskRatio(ep: number, tp1: number, sl: number): number {
    if (!ep || !tp1 || !sl) return 0;
    const reward = tp1 - ep;
    const risk = ep - sl;
    if (risk <= 0) return 0;
    return Number((reward / risk).toFixed(2));
  }

  // ============================================
  // FORMATTING
  // ============================================

  private formatSignalResponse(
    row: any,
    viewerAccess: {
      isAdmin: boolean;
      hasPremium: boolean;
      userId: string | null;
    },
    tab?: 'live' | 'results',
  ) {
    const isLocked = this.calculateIsLocked(row, viewerAccess, tab);

    // Raqamli qiymatlarni olish (hisoblash uchun DOIMO kerak)
    const ep = Number(row.ep) || 0;
    const tp1 = Number(row.tp1) || 0;
    const tp2 = row.tp2 ? Number(row.tp2) : null;
    const sl = Number(row.sl) || 0;

    // potentialProfit/Loss/riskRatio BARCHA signallarda ko'rinadi
    const potentialProfit = this.calculatePotentialProfit(ep, tp1);
    const potentialLoss = this.calculatePotentialLoss(ep, sl);
    const riskRatio = this.calculateRiskRatio(ep, tp1, sl);

    return {
      id: row.id,
      // Locked bo'lsa ticker va narxlar yashiriladi
      ticker: isLocked ? '********' : row.ticker,
      direction: row.direction || 'BUY',
      entry: isLocked ? null : ep,
      ep: isLocked ? null : ep,
      tp1: isLocked ? null : tp1,
      tp2: isLocked ? null : tp2,
      sl: isLocked ? null : sl,
      currentPrice: null,
      status: this.mapStatus(row.status),
      accessType: row.access_type,
      isFree: row.access_type === 'FREE',
      price: Number(row.price) || 0,
      discountPercent: 0,
      islamiclyStatus: row.islamicly_status,
      musaffaStatus: row.musaffa_status,
      isLocked,
      isPurchased: row.is_purchased === true,

      // BARCHA signallarda ko'rinadi (locked ham)
      potentialProfit,
      potentialLoss,
      riskRatio,

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
