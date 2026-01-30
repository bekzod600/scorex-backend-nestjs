// src/wallet/wallet.service.ts
// YANGILANGAN - to'g'ri response format

import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { WalletTransactionType } from './types/wallet.types';

export interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  creditedAmount: number;
  status: string;
  description: string;
  createdAt: string;
}

@Injectable()
export class WalletService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getWallet(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT balance, currency FROM wallets WHERE user_id = $1`,
      [userId],
    );

    if (!rows[0]) {
      // Wallet yo'q bo'lsa, yaratamiz
      await this.pool.query(
        `INSERT INTO wallets (user_id, balance, currency) VALUES ($1, 0, 'USD')`,
        [userId],
      );
      return { balance: 0, currency: 'USD' };
    }

    return {
      balance: Number(rows[0].balance),
      currency: rows[0].currency,
    };
  }

  async credit(userId: string, amount: number, type: WalletTransactionType) {
    if (amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    await this.pool.query('BEGIN');

    try {
      // Ensure wallet exists
      await this.pool.query(
        `
        INSERT INTO wallets (user_id, balance, currency) 
        VALUES ($1, 0, 'USD')
        ON CONFLICT (user_id) DO NOTHING
        `,
        [userId],
      );

      await this.pool.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, status)
        VALUES ($1, $2, $3, 'confirmed')
        `,
        [userId, type, amount],
      );

      await this.pool.query(
        `
        UPDATE wallets
        SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2
        `,
        [amount, userId],
      );

      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
  }

  async debit(userId: string, amount: number, type: WalletTransactionType) {
    if (amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    await this.pool.query('BEGIN');

    try {
      const { rows } = await this.pool.query(
        `SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE`,
        [userId],
      );

      if (!rows[0] || Number(rows[0].balance) < amount) {
        throw new BadRequestException('Insufficient balance');
      }

      await this.pool.query(
        `
        INSERT INTO wallet_transactions (user_id, type, amount, status)
        VALUES ($1, $2, $3, 'confirmed')
        `,
        [userId, type, -amount],
      );

      await this.pool.query(
        `
        UPDATE wallets
        SET balance = balance - $1, updated_at = NOW()
        WHERE user_id = $2
        `,
        [amount, userId],
      );

      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
  }

  /**
   * Get transactions with proper response format
   */
  async getTransactions(userId: string): Promise<{ transactions: WalletTransaction[] }> {
    const { rows } = await this.pool.query(
      `
      SELECT id, type, amount, status, provider, meta, created_at
      FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
      `,
      [userId],
    );

    const transactions: WalletTransaction[] = rows.map((row) => ({
      id: row.id,
      type: this.mapTransactionType(row.type),
      amount: Math.abs(Number(row.amount)),
      fee: 0, // TODO: implement fee tracking
      creditedAmount: Math.abs(Number(row.amount)),
      status: this.mapStatus(row.status),
      description: this.getDescription(row.type, row.meta),
      createdAt: row.created_at,
    }));

    return { transactions };
  }

  /**
   * Map backend transaction type to frontend type
   */
  private mapTransactionType(type: string): string {
    const typeMap: Record<string, string> = {
      TOPUP: 'top-up',
      SIGNAL_BUY: 'purchase',
      SUBSCRIPTION_BUY: 'subscription',
      REFUND: 'refund',
      ADJUSTMENT: 'adjustment',
    };
    return typeMap[type] || type.toLowerCase();
  }

  /**
   * Map status
   */
  private mapStatus(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'pending',
      confirmed: 'completed',
      rejected: 'rejected',
    };
    return statusMap[status] || status;
  }

  /**
   * Get human-readable description
   */
  private getDescription(type: string, meta?: any): string {
    const descriptions: Record<string, string> = {
      TOPUP: 'Wallet top-up',
      SIGNAL_BUY: meta?.ticker ? `Signal unlock - ${meta.ticker}` : 'Signal purchase',
      SUBSCRIPTION_BUY: 'Premium subscription',
      REFUND: 'Refund',
      ADJUSTMENT: 'Balance adjustment',
    };
    return descriptions[type] || 'Transaction';
  }
}
