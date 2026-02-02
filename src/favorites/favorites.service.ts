// src/favorites/favorites.service.ts
// YANGILANGAN - Subscription-based locking logic

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

  async addFavorite(userId: string, signalId: string): Promise<void> {
    const signal = await this.signalsService.findById(signalId);
    if (!signal) {
      throw new NotFoundException('Signal not found');
    }

    const { rows: existing } = await this.pool.query(
      `SELECT id FROM signal_favorites
       WHERE user_id = $1 AND signal_id = $2 LIMIT 1`,
      [userId, signalId],
    );

    if (existing.length > 0) {
      throw new BadRequestException('Signal already in favorites');
    }

    await this.pool.query(
      `INSERT INTO signal_favorites (user_id, signal_id) VALUES ($1, $2)`,
      [userId, signalId],
    );
  }

  async removeFavorite(userId: string, signalId: string): Promise<void> {
    const { rows: existing } = await this.pool.query(
      `SELECT id FROM signal_favorites
       WHERE user_id = $1 AND signal_id = $2 LIMIT 1`,
      [userId, signalId],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Signal not in favorites');
    }

    await this.pool.query(
      `DELETE FROM signal_favorites WHERE user_id = $1 AND signal_id = $2`,
      [userId, signalId],
    );
  }

  async getFavorites(userId: string) {
    // Get viewer's access level
    const viewerAccess = await this.getViewerAccess(userId);

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

    const signals = rows.map((row) =>
      this.formatSignalResponse(row, viewerAccess),
    );

    return {
      signals,
      total: signals.length,
    };
  }

  // ============================================
  // ACCESS CONTROL
  // ============================================

  private async getViewerAccess(viewerId: string): Promise<{
    isAdmin: boolean;
    hasPremium: boolean;
    userId: string;
  }> {
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
      return { isAdmin: false, hasPremium: false, userId: viewerId };
    }

    const user = rows[0];
    const isAdmin = user.role === 'admin';
    const hasPremium =
      user.subscription_plan === 'premium' &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date();

    return { isAdmin, hasPremium, userId: user.id };
  }

  private calculateIsLocked(
    row: any,
    viewerAccess: { isAdmin: boolean; hasPremium: boolean; userId: string },
  ): boolean {
    const isFree = row.access_type === 'FREE';
    const isPurchased = row.is_purchased === true;
    const isOwner = row.seller_id === viewerAccess.userId;
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      row.status,
    );

    // Admin - barcha signallar ochiq
    if (viewerAccess.isAdmin) {
      return false;
    }

    // Signal egasi - o'z signallari ochiq
    if (isOwner) {
      return false;
    }

    // Sotib olingan - ochiq
    if (isPurchased) {
      return false;
    }

    // Yopilgan signallar - ochiq (tarixiy)
    if (isClosedStatus) {
      return false;
    }

    // FREE + Premium - ochiq
    if (isFree && viewerAccess.hasPremium) {
      return false;
    }

    // Boshqa hollarda - yopiq
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
    viewerAccess: { isAdmin: boolean; hasPremium: boolean; userId: string },
  ) {
    const isLocked = this.calculateIsLocked(row, viewerAccess);

    const ep = Number(row.ep) || 0;
    const tp1 = Number(row.tp1) || 0;
    const tp2 = row.tp2 ? Number(row.tp2) : null;
    const sl = Number(row.sl) || 0;

    // BARCHA signallarda hisoblanadi
    const potentialProfit = this.calculatePotentialProfit(ep, tp1);
    const potentialLoss = this.calculatePotentialLoss(ep, sl);
    const riskRatio = this.calculateRiskRatio(ep, tp1, sl);

    return {
      id: row.id,
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

      // BARCHA signallarda ko'rinadi
      potentialProfit,
      potentialLoss,
      riskRatio,

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
