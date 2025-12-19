import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { RATING_RULES } from './rating.rules';
import { SignalAccessType } from '../signals/constants/signal.constants';

type CloseReason = 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELED';

@Injectable()
export class RatingService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async applyForSignal(signalId: string) {
    const signal = await this.getSignal(signalId);
    if (!signal) return;

    const reason = this.mapReason(signal.status as CloseReason);
    if (!reason) return;

    const delta =
      this.calcBaseDelta(signal.access_type as SignalAccessType, reason) +
      this.calcProfitBonus(signal, reason);

    if (delta !== 0) {
      await this.applyDelta(
        signal.seller_id as string,
        signal.id as string,
        delta,
        reason as CloseReason,
      );
    }
  }

  private async getSignal(signalId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM signals WHERE id = $1`,
      [signalId],
    );
    return rows[0] ?? null;
  }

  private mapReason(status: string): 'TP' | 'SL' | 'CANCEL' | null {
    if (status === 'CLOSED_TP') return 'TP';
    if (status === 'CLOSED_SL') return 'SL';
    if (status === 'CANCELED') return 'CANCEL';
    return null;
  }

  private calcBaseDelta(
    accessType: 'FREE' | 'PAID',
    reason: 'TP' | 'SL' | 'CANCEL',
  ): number {
    return RATING_RULES[accessType][reason] ?? 0;
  }

  private calcProfitBonus(signal: any, reason: string): number {
    if (reason !== 'TP') return 0;
    if (!signal.ep || !signal.tp1) return 0;

    const profitPercent =
      ((Number(signal.tp1) - Number(signal.ep)) / Number(signal.ep)) * 100;

    if (profitPercent < RATING_RULES.PROFIT_BONUS_STEP) return 0;

    return (
      Math.floor(profitPercent / RATING_RULES.PROFIT_BONUS_STEP) *
      RATING_RULES.PROFIT_BONUS_SCORE
    );
  }

  private async applyDelta(
    userId: string,
    signalId: string,
    delta: number,
    reason: string,
  ) {
    await this.pool.query('BEGIN');

    try {
      await this.pool.query(
        `
        UPDATE users
        SET score_x = GREATEST($1, score_x + $2)
        WHERE id = $3
        `,
        [RATING_RULES.BASE_SCORE, delta, userId],
      );

      await this.pool.query(
        `
        INSERT INTO rating_logs (user_id, signal_id, delta, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, signalId, delta, reason],
      );

      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
  }
}
