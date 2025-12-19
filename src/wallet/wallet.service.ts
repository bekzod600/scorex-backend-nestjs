import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { Pool } from 'pg';
import { WalletTransactionType } from './types/wallet.types';

@Injectable()
export class WalletService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async getWallet(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT balance FROM wallets WHERE user_id = $1`,
      [userId],
    );

    if (!rows[0]) {
      await this.pool.query(
        `INSERT INTO wallets (user_id, balance) VALUES ($1, 0)`,
        [userId],
      );
      return { balance: 0 };
    }

    return rows[0];
  }

  async credit(userId: string, amount: number, type: WalletTransactionType) {
    if (amount <= 0) {
      throw new BadRequestException('Invalid amount');
    }

    await this.pool.query('BEGIN');

    try {
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

  async getTransactions(userId: string) {
    const { rows } = await this.pool.query(
      `
      SELECT id,type,amount,status,created_at
      FROM wallet_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId],
    );
    return rows;
  }
}
