import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { WalletService } from '../wallet/wallet.service';
import { SignalsService } from '../signals/signals.service';

@Injectable()
export class PurchasesService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly walletService: WalletService,
    private readonly signalsService: SignalsService,
  ) {}

  async buySignal(userId: string, signalId: string) {
    await this.pool.query('BEGIN');

    try {
      const signal = await this.signalsService.findById(signalId);
      if (!signal) {
        throw new BadRequestException('Signal not found');
      }

      if (signal.access_type !== 'PAID') {
        throw new BadRequestException('Signal is free');
      }

      // check already purchased
      const purchased = await this.pool.query(
        `
        SELECT 1 FROM signal_purchases
        WHERE user_id = $1 AND signal_id = $2
        `,
        [userId, signalId],
      );
      if (purchased.rowCount > 0) {
        throw new BadRequestException('Already purchased');
      }

      const price = Number(signal.price);
      if (!price || price <= 0) {
        throw new BadRequestException('Invalid signal price');
      }

      // debit wallet (throws if insufficient)
      await this.walletService.debit(userId, price, 'SIGNAL_BUY');

      // record purchase
      await this.pool.query(
        `
        INSERT INTO signal_purchases (user_id, signal_id)
        VALUES ($1, $2)
        `,
        [userId, signalId],
      );

      await this.pool.query('COMMIT');

      return { success: true };
    } catch (err) {
      await this.pool.query('ROLLBACK');
      throw err;
    }
  }
}
