// src/traders/traders.service.ts
// YANGILANGAN - Results tab da signallar doimo ochiq

import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class TradersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Get traders leaderboard
   */
  async list(params?: {
    sortBy?: 'scorex' | 'profit' | 'stars';
    page?: number;
    limit?: number;
  }) {
    const sortBy = params?.sortBy || 'scorex';
    const page = params?.page || 1;
    const limit = Math.min(params?.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build ORDER BY clause
    let orderBy = 'u.score_x DESC';
    if (sortBy === 'profit') {
      orderBy = 'COALESCE(ts.avg_profit_percent, 0) DESC';
    } else if (sortBy === 'stars') {
      orderBy = 'COALESCE(tr.avg_stars, 0) DESC';
    }

    const { rows } = await this.pool.query(
      `
      WITH trader_stats AS (
        SELECT 
          seller_id,
          COUNT(*) as total_signals,
          COUNT(*) FILTER (WHERE status = 'CLOSED_TP') as successful_signals,
          AVG(CASE WHEN status IN ('CLOSED_TP', 'CLOSED_SL') 
              THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400 
              ELSE NULL END) as avg_days,
          AVG(CASE WHEN status = 'CLOSED_TP' THEN 10 
                   WHEN status = 'CLOSED_SL' THEN -5 
                   ELSE 0 END) as avg_profit_percent
        FROM signals
        GROUP BY seller_id
      ),
      subscriber_counts AS (
        SELECT trader_id, COUNT(*) as subscribers
        FROM subscriptions
        GROUP BY trader_id
      ),
      trader_ratings AS (
        SELECT trader_id, AVG(stars)::numeric(3,2) as avg_stars
        FROM trader_stars
        GROUP BY trader_id
      ),
      ranked_traders AS (
        SELECT 
          u.id,
          ROW_NUMBER() OVER (ORDER BY ${orderBy}) as rank
        FROM users u
        LEFT JOIN trader_stats ts ON ts.seller_id = u.id
        LEFT JOIN trader_ratings tr ON tr.trader_id = u.id
        WHERE ts.total_signals > 0
      )
      SELECT 
        u.id,
        u.telegram_username as username,
        COALESCE(u.telegram_first_name, u.telegram_username) as display_name,
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
      WHERE ts.total_signals > 0
      ORDER BY ${orderBy}
      LIMIT $1 OFFSET $2
      `,
      [limit, offset],
    );

    // Get total count
    const { rows: countRows } = await this.pool.query(
      `
      SELECT COUNT(DISTINCT s.seller_id) as total
      FROM signals s
      `,
    );

    return {
      traders: rows.map((row) => ({
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
      })),
      total: Number(countRows[0]?.total || 0),
    };
  }

  /**
   * Get trader by username
   */
  async findByUsername(username: string) {
    const { rows } = await this.pool.query(
      `
      WITH trader_stats AS (
        SELECT 
          seller_id,
          COUNT(*) as total_signals,
          COUNT(*) FILTER (WHERE status = 'CLOSED_TP') as successful_signals,
          AVG(CASE WHEN status IN ('CLOSED_TP', 'CLOSED_SL') 
              THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400 
              ELSE NULL END) as avg_days,
          AVG(CASE WHEN status = 'CLOSED_TP' THEN 10 
                   WHEN status = 'CLOSED_SL' THEN -5 
                   ELSE 0 END) as avg_profit_percent
        FROM signals
        GROUP BY seller_id
      ),
      subscriber_counts AS (
        SELECT trader_id, COUNT(*) as subscribers
        FROM subscriptions
        GROUP BY trader_id
      ),
      trader_ratings AS (
        SELECT trader_id, AVG(stars)::numeric(3,2) as avg_stars
        FROM trader_stars
        GROUP BY trader_id
      ),
      ranked_traders AS (
        SELECT 
          u.id,
          ROW_NUMBER() OVER (ORDER BY u.score_x DESC) as rank
        FROM users u
        LEFT JOIN trader_stats ts ON ts.seller_id = u.id
        WHERE ts.total_signals > 0 OR u.telegram_username = $1
      )
      SELECT 
        u.id,
        u.telegram_username as username,
        COALESCE(u.telegram_first_name, u.telegram_username) as display_name,
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

    // MUHIM: tab parametrini formatSignal ga uzatamiz
    return rows.map((s) => this.formatSignal(s, false, tab));
  }

  /**
   * Helper to format signal response
   * @param row - Database row
   * @param defaultLocked - Default locked state
   * @param tab - Optional tab ('live' | 'results')
   */
  private formatSignal(
    row: any,
    defaultLocked: boolean,
    tab?: 'live' | 'results',
  ) {
    // MUHIM: Results tab yoki yopilgan status = doimo ochiq
    const isClosedStatus = ['CLOSED_TP', 'CLOSED_SL', 'CANCELED'].includes(
      row.status,
    );
    const isLocked = defaultLocked && !isClosedStatus && tab !== 'results';

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
