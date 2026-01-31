// src/subscriptions/subscriptions.service.ts
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { TradersService } from '../traders/traders.service';

export interface Subscription {
  id: string;
  traderId: string;
  traderUsername: string;
  traderDisplayName: string | null;
  traderAvatar: string | null;
  createdAt: string;
}

@Injectable()
export class SubscriptionsService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly tradersService: TradersService,
  ) {}

  /**
   * Subscribe to a trader by username
   */
  async subscribe(userId: string, traderUsername: string): Promise<void> {
    // Get trader by username
    const trader = await this.tradersService.findByUsername(traderUsername);

    // Check if user is trying to subscribe to themselves
    if (trader.id === userId) {
      throw new BadRequestException('Cannot subscribe to yourself');
    }

    // Check if already subscribed
    const { rows: existing } = await this.pool.query(
      `
      SELECT id FROM subscriptions
      WHERE user_id = $1 AND trader_id = $2
      LIMIT 1
      `,
      [userId, trader.id],
    );

    if (existing.length > 0) {
      throw new BadRequestException('Already subscribed to this trader');
    }

    // Create subscription
    await this.pool.query(
      `
      INSERT INTO subscriptions (user_id, trader_id)
      VALUES ($1, $2)
      `,
      [userId, trader.id],
    );
  }

  /**
   * Unsubscribe from a trader by username
   */
  async unsubscribe(userId: string, traderUsername: string): Promise<void> {
    // Get trader by username
    const trader = await this.tradersService.findByUsername(traderUsername);

    // Check if subscribed
    const { rows: existing } = await this.pool.query(
      `
      SELECT id FROM subscriptions
      WHERE user_id = $1 AND trader_id = $2
      LIMIT 1
      `,
      [userId, trader.id],
    );

    if (existing.length === 0) {
      throw new NotFoundException('Not subscribed to this trader');
    }

    // Delete subscription
    await this.pool.query(
      `
      DELETE FROM subscriptions
      WHERE user_id = $1 AND trader_id = $2
      `,
      [userId, trader.id],
    );
  }

  /**
   * Get all subscriptions for a user
   */
  async getSubscriptions(userId: string): Promise<Subscription[]> {
    const { rows } = await this.pool.query(
      `
      SELECT 
        s.id,
        s.trader_id,
        s.created_at,
        u.telegram_username as trader_username,
        u.telegram_first_name as trader_display_name,
        u.avatar as trader_avatar
      FROM subscriptions s
      JOIN users u ON u.id = s.trader_id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      `,
      [userId],
    );

    return rows.map((row) => ({
      id: row.id,
      traderId: row.trader_id,
      traderUsername: row.trader_username || 'Unknown',
      traderDisplayName: row.trader_display_name,
      traderAvatar: row.trader_avatar,
      createdAt: row.created_at,
    }));
  }
}

