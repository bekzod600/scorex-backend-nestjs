// src/favorites/favorites.service.ts
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { SignalsService } from '../signals/signals.service';

@Injectable()
export class FavoritesService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly signalsService: SignalsService,
  ) {}

  /**
   * Add signal to favorites
   */
  async addFavorite(userId: string, signalId: string): Promise<void> {
    // Check if signal exists
    const signal = await this.signalsService.findById(signalId);
    if (!signal) {
      throw new NotFoundException('Signal not found');
    }

    // Check if already favorited
    const { rows: existing } = await this.pool.query(
      `
      SELECT id FROM signal_favorites
      WHERE user_id = $1 AND signal_id = $2
      LIMIT 1
      `,
      [userId, signalId],
    );

    if (existing.length > 0) {
      throw new BadRequestException('Signal already in favorites');
    }

    // Add to favorites
    await this.pool.query(
      `
      INSERT INTO signal_favorites (user_id, signal_id)
      VALUES ($1, $2)
      `,
      [userId, signalId],
    );
  }

  /**
   * Remove signal from favorites
   */
  async removeFavorite(userId: string, signalId: string): Promise<void> {
    // Check if favorited
    const { rows: existing } = await this.pool.query(
      `
      SELECT id FROM signal_favorites
      WHERE user_id = $1 AND signal_id = $2
      LIMIT 1
      `,
      [userId, signalId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Signal not in favorites');
    }

    // Remove from favorites
    await this.pool.query(
      `
      DELETE FROM signal_favorites
      WHERE user_id = $1 AND signal_id = $2
      `,
      [userId, signalId],
    );
  }

  /**
   * Get user's favorite signals
   */
  async getFavorites(userId: string) {
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
        ) AS is_purchased,
        sf.created_at as favorited_at
      FROM signal_favorites sf
      JOIN signals s ON s.id = sf.signal_id
      LEFT JOIN users u ON u.id = s.seller_id
      WHERE sf.user_id = $1
      ORDER BY sf.created_at DESC
      `,
      [userId],
    );

    // Format signals using the same method as SignalsService
    const signals = rows.map((row) => this.formatSignalResponse(row, userId));

    return {
      signals,
      total: signals.length,
    };
  }

  /**
   * Format signal response for frontend (similar to SignalsService)
   */
  private formatSignalResponse(row: any, userId: string) {
    const isPaid = row.access_type === 'PAID';
    const isPurchased = row.is_purchased === true;
    const isLocked = isPaid && !isPurchased;

    return {
      id: row.id,
      ticker: isLocked ? '********' : row.ticker,
      direction: row.direction || 'BUY',
      entry: isLocked ? null : Number(row.ep),
      ep: isLocked ? null : Number(row.ep),
      tp1: isLocked ? null : Number(row.tp1),
      tp2: row.tp2 ? (isLocked ? null : Number(row.tp2)) : null,
      sl: isLocked ? null : Number(row.sl),
      currentPrice: null, // TODO: fetch from price_cache
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
      favoritedAt: row.favorited_at,
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

