// src/subscription/subscription.service.ts
// Premium subscription management service

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';

export interface SubscriptionStatus {
  plan: 'free' | 'premium';
  expiresAt: string | null;
  autoRenew: boolean;
  isActive: boolean;
  daysRemaining: number | null;
}

export interface SubscriptionPurchaseResult {
  success: boolean;
  message: string;
  newBalance: number;
  subscription: SubscriptionStatus;
}

@Injectable()
export class SubscriptionService {
  // Premium price in USD
  private readonly PREMIUM_PRICE = 29.99;
  // Subscription duration in days
  private readonly SUBSCRIPTION_DAYS = 30;

  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  /**
   * Get user's subscription status
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus> {
    const { rows } = await this.pool.query(
      `
      SELECT 
        subscription_plan,
        subscription_expires_at,
        subscription_auto_renew,
        role
      FROM users
      WHERE id = $1
      `,
      [userId],
    );

    if (!rows[0]) {
      throw new NotFoundException('User not found');
    }

    const user = rows[0];
    const now = new Date();
    const expiresAt = user.subscription_expires_at
      ? new Date(user.subscription_expires_at)
      : null;

    // Admin always has premium access
    if (user.role === 'admin') {
      return {
        plan: 'premium',
        expiresAt: null,
        autoRenew: false,
        isActive: true,
        daysRemaining: null, // Unlimited for admin
      };
    }

    const isActive =
      user.subscription_plan === 'premium' && expiresAt && expiresAt > now;

    const daysRemaining =
      isActive && expiresAt
        ? Math.ceil(
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          )
        : null;

    return {
      plan: user.subscription_plan,
      expiresAt: user.subscription_expires_at,
      autoRenew: user.subscription_auto_renew || false,
      isActive: isActive ?? false,
      daysRemaining,
    };
  }

  /**
   * Purchase premium subscription
   */
  async purchasePremium(userId: string): Promise<SubscriptionPurchaseResult> {
    // Start transaction
    await this.pool.query('BEGIN');

    try {
      // Get user's wallet balance
      const { rows: walletRows } = await this.pool.query(
        `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );

      if (!walletRows[0]) {
        throw new NotFoundException('Wallet not found');
      }

      const currentBalance = Number(walletRows[0].balance);

      if (currentBalance < this.PREMIUM_PRICE) {
        await this.pool.query('ROLLBACK');
        throw new BadRequestException(
          `Insufficient balance. You need $${this.PREMIUM_PRICE}, but have $${currentBalance.toFixed(2)}`,
        );
      }

      // Calculate new expiry date
      const { rows: userRows } = await this.pool.query(
        `SELECT subscription_expires_at FROM users WHERE id = $1`,
        [userId],
      );

      const currentExpiry = userRows[0]?.subscription_expires_at;
      const now = new Date();

      // If already premium and not expired, extend from current expiry
      // Otherwise, start from now
      let startsAt = now;
      if (currentExpiry && new Date(currentExpiry) > now) {
        startsAt = new Date(currentExpiry);
      }

      const endsAt = new Date(startsAt);
      endsAt.setDate(endsAt.getDate() + this.SUBSCRIPTION_DAYS);

      // Deduct from wallet
      const newBalance = currentBalance - this.PREMIUM_PRICE;
      await this.pool.query(
        `UPDATE wallets SET balance = $2, updated_at = NOW() WHERE user_id = $1`,
        [userId, newBalance],
      );

      // Update user subscription
      await this.pool.query(
        `
        UPDATE users
        SET subscription_plan = 'premium',
            subscription_expires_at = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [userId, endsAt],
      );

      // Record transaction
      await this.pool.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, status, meta)
        VALUES ($1, 'SUBSCRIPTION_BUY', $2, 'confirmed', $3)
        `,
        [
          userId,
          -this.PREMIUM_PRICE,
          JSON.stringify({
            plan: 'premium',
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
          }),
        ],
      );

      // Record subscription transaction
      await this.pool.query(
        `
        INSERT INTO subscription_transactions (user_id, type, amount, plan, starts_at, ends_at)
        VALUES ($1, 'purchase', $2, 'premium', $3, $4)
        `,
        [userId, this.PREMIUM_PRICE, startsAt, endsAt],
      );

      await this.pool.query('COMMIT');

      return {
        success: true,
        message: 'Premium subscription activated successfully',
        newBalance,
        subscription: {
          plan: 'premium',
          expiresAt: endsAt.toISOString(),
          autoRenew: false,
          isActive: true,
          daysRemaining: this.SUBSCRIPTION_DAYS,
        },
      };
    } catch (error) {
      await this.pool.query('ROLLBACK');
      throw error;
    }
  }

  /**
   * Set auto-renew setting
   */
  async setAutoRenew(userId: string, enabled: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE users SET subscription_auto_renew = $2, updated_at = NOW() WHERE id = $1`,
      [userId, enabled],
    );
  }

  /**
   * Cancel subscription (disable auto-renew, keep until expiry)
   */
  async cancelSubscription(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE users SET subscription_auto_renew = FALSE, updated_at = NOW() WHERE id = $1`,
      [userId],
    );
  }

  /**
   * Check if user has premium access (admin or active premium)
   */
  async hasActivePremium(userId: string): Promise<boolean> {
    const { rows } = await this.pool.query(
      `
      SELECT 1 FROM users
      WHERE id = $1
      AND (
        role = 'admin'
        OR (
          subscription_plan = 'premium'
          AND subscription_expires_at > NOW()
        )
      )
      `,
      [userId],
    );

    return rows.length > 0;
  }

  /**
   * Get user role (for isLocked calculation)
   */
  async getUserAccessLevel(
    userId: string,
  ): Promise<{ isAdmin: boolean; hasPremium: boolean }> {
    const { rows } = await this.pool.query(
      `
      SELECT 
        role,
        subscription_plan,
        subscription_expires_at
      FROM users
      WHERE id = $1
      `,
      [userId],
    );

    if (!rows[0]) {
      return { isAdmin: false, hasPremium: false };
    }

    const user = rows[0];
    const isAdmin = user.role === 'admin';
    const hasPremium =
      user.subscription_plan === 'premium' &&
      user.subscription_expires_at &&
      new Date(user.subscription_expires_at) > new Date();
    return { isAdmin, hasPremium };
  }
}
