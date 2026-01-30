// src/traders/traders.service.ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface TraderProfile {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  scoreXPoints: number;
  rank: number;
  totalSignals: number;
  successfulSignals: number;
  avgStars: number;
  totalPLPercent: number;
  subscribers: number;
  avgDaysToResult: number;
  createdAt: string;
}

@Injectable()
export class TradersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Get traders leaderboard with sorting
   */
  async list(params?: {
    sortBy?: 'scorex' | 'profit' | 'stars';
    page?: number;
    limit?: number;
  }): Promise<{ traders: TraderProfile[]; total: number }> {
    const sortBy = params?.sortBy || 'scorex';
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Determine ORDER BY clause
    let orderBy = 'u.score_x DESC';
    if (sortBy === 'profit') {
      orderBy = 'total_pl_percent DESC';
    } else if (sortBy === 'stars') {
      orderBy = 'avg_stars DESC';
    }

    // Get traders with signal statistics
    const { rows } = await this.pool.query(
      `
      WITH trader_stats AS (
        SELECT 
          seller_id,
          COUNT(*) as total_signals,
          COUNT(*) FILTER (WHERE status = 'CLOSED_TP') as successful_signals,
          AVG(
            CASE WHEN status = 'CLOSED_TP' AND ep > 0 
            THEN ((tp1 - ep) / ep * 100) 
            ELSE 0 END
          ) as avg_profit_percent,
          AVG(
            EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400
          ) FILTER (WHERE closed_at IS NOT NULL) as avg_days
        FROM signals
        GROUP BY seller_id
      ),
      subscriber_counts AS (
        SELECT 
          trader_id,
          COUNT(*) as subscribers
        FROM subscriptions
        GROUP BY trader_id
      ),
      trader_ratings AS (
        SELECT 
          trader_id,
          AVG(stars) as avg_stars
        FROM trader_stars
        GROUP BY trader_id
      )
      SELECT 
        u.id,
        COALESCE(u.telegram_username, u.email, 'user_' || LEFT(u.id::text, 8)) as username,
        u.telegram_first_name as display_name,
        u.avatar,
        u.score_x as score_x_points,
        COALESCE(ts.total_signals, 0)::int as total_signals,
        COALESCE(ts.successful_signals, 0)::int as successful_signals,
        COALESCE(tr.avg_stars, 0)::numeric(3,2) as avg_stars,
        COALESCE(ts.avg_profit_percent, 0)::numeric(5,2) as total_pl_percent,
        COALESCE(sc.subscribers, 0)::int as subscribers,
        COALESCE(ts.avg_days, 0)::numeric(5,2) as avg_days_to_result,
        u.created_at,
        ROW_NUMBER() OVER (ORDER BY ${orderBy}) as rank
      FROM users u
      LEFT JOIN trader_stats ts ON ts.seller_id = u.id
      LEFT JOIN subscriber_counts sc ON sc.trader_id = u.id
      LEFT JOIN trader_ratings tr ON tr.trader_id = u.id
      WHERE EXISTS (SELECT 1 FROM signals s WHERE s.seller_id = u.id)
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    // Get total count
    const { rows: countRows } = await this.pool.query(
      `
      SELECT COUNT(DISTINCT seller_id) as total
      FROM signals
      `,
    );

    const traders: TraderProfile[] = rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar,
      scoreXPoints: Number(row.score_x_points),
      rank: Number(row.rank),
      totalSignals: row.total_signals,
      successfulSignals: row.successful_signals,
      avgStars: Number(row.avg_stars),
      totalPLPercent: Number(row.total_pl_percent),
      subscribers: row.subscribers,
      avgDaysToResult: Number(row.avg_days_to_result),
      createdAt: row.created_at,
    }));

    return {
      traders,
      total: Number(countRows[0]?.total || 0),
    };
  }

  /**
   * Get trader profile by username
   */
  async findByUsername(username: string): Promise<TraderProfile> {
    const { rows } = await this.pool.query(
      `
      WITH trader_stats AS (
        SELECT 
          seller_id,
          COUNT(*) as total_signals,
          COUNT(*) FILTER (WHERE status = 'CLOSED_TP') as successful_signals,
          AVG(
            CASE WHEN status = 'CLOSED_TP' AND ep > 0 
            THEN ((tp1 - ep) / ep * 100) 
            ELSE 0 END
          ) as avg_profit_percent,
          AVG(
            EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400
          ) FILTER (WHERE closed_at IS NOT NULL) as avg_days
        FROM signals
        GROUP BY seller_id
      ),
      subscriber_counts AS (
        SELECT trader_id, COUNT(*) as subscribers
        FROM subscriptions
        GROUP BY trader_id
      ),
      trader_ratings AS (
        SELECT trader_id, AVG(stars) as avg_stars
        FROM trader_stars
        GROUP BY trader_id
      ),
      ranked_traders AS (
        SELECT 
          u.id,
          ROW_NUMBER() OVER (ORDER BY u.score_x DESC) as rank
        FROM users u
        WHERE EXISTS (SELECT 1 FROM signals s WHERE s.seller_id = u.id)
      )
      SELECT 
        u.id,
        COALESCE(u.telegram_username, u.email, 'user_' || LEFT(u.id::text, 8)) as username,
        u.telegram_first_name as display_name,
        u.avatar,
        u.score_x as score_x_points,
        COALESCE(ts.total_signals, 0)::int as total_signals,
        COALESCE(ts.successful_signals, 0)::int as successful_signals,
        COALESCE(tr.avg_stars, 0)::numeric(3,2) as avg_stars,
        COALESCE(ts.avg_profit_percent, 0)::numeric(5,2) as total_pl_percent,
        COALESCE(sc.subscribers, 0)::int as subscribers,
        COALESCE(ts.avg_days, 0)::numeric(5,2) as avg_days_to_result,
        u.created_at,
        COALESCE(rt.rank, 0) as rank
      FROM users u
      LEFT JOIN trader_stats ts ON ts.seller_id = u.id
      LEFT JOIN subscriber_counts sc ON sc.trader_id = u.id
      LEFT JOIN trader_ratings tr ON tr.trader_id = u.id
      LEFT JOIN ranked_traders rt ON rt.id = u.id
      WHERE u.telegram_username = $1 
         OR u.email = $1
         OR u.id::text = $1
      LIMIT 1
      `,
      [username],
    );

    if (!rows[0]) {
      throw new NotFoundException(`Trader @${username} not found`);
    }

    const row = rows[0];
    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatar: row.avatar,
      scoreXPoints: Number(row.score_x_points),
      rank: Number(row.rank),
      totalSignals: row.total_signals,
      successfulSignals: row.successful_signals,
      avgStars: Number(row.avg_stars),
      totalPLPercent: Number(row.total_pl_percent),
      subscribers: row.subscribers,
      avgDaysToResult: Number(row.avg_days_to_result),
      createdAt: row.created_at,
    };
  }

  /**
   * Get signals by trader username
   */
  async getSignalsByUsername(
    username: string,
    params?: { tab?: 'live' | 'results' },
  ) {
    // First, get trader ID
    const { rows: userRows } = await this.pool.query(
      `
      SELECT id FROM users 
      WHERE telegram_username = $1 OR email = $1 OR id::text = $1
      LIMIT 1
      `,
      [username],
    );

    if (!userRows[0]) {
      throw new NotFoundException(`Trader @${username} not found`);
    }

    const traderId = userRows[0].id;
    const tab = params?.tab || 'live';

    // Build status filter
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
        u.score_x as trader_score_x
      FROM signals s
      JOIN users u ON u.id = s.seller_id
      WHERE s.seller_id = $1
      ${statusFilter}
      ORDER BY s.created_at DESC
      `,
      [traderId],
    );

    return rows.map((s) => this.formatSignal(s, false));
  }

  /**
   * Helper to format signal response
   */
  private formatSignal(row: any, isLocked: boolean) {
    return {
      id: row.id,
      ticker: isLocked ? '********' : row.ticker,
      direction: row.direction,
      entry: isLocked ? null : Number(row.ep),
      ep: isLocked ? null : Number(row.ep),
      tp1: isLocked ? null : Number(row.tp1),
      tp2: row.tp2 ? Number(row.tp2) : null,
      sl: isLocked ? null : Number(row.sl),
      status: this.mapStatus(row.status),
      accessType: row.access_type,
      isFree: row.access_type === 'FREE',
      price: Number(row.price) || 0,
      islamiclyStatus: row.islamicly_status,
      musaffaStatus: row.musaffa_status,
      isLocked,
      isPurchased: !isLocked,
      createdAt: row.created_at,
      closedAt: row.closed_at,
      enteredAt: row.entered_at,
      trader: {
        id: row.seller_id,
        username: row.trader_username || 'Unknown',
        displayName: row.trader_display_name,
        avatar: row.trader_avatar,
        scoreXPoints: Number(row.trader_score_x) || 1000,
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
