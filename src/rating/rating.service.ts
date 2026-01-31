import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { RATING_RULES } from './rating.rules';
import { SignalAccessType } from '../signals/constants/signal.constants';
import { TradersService } from '../traders/traders.service';
import { VoteType } from './dto/vote-signal.dto';

type CloseReason = 'CLOSED_TP' | 'CLOSED_SL' | 'CANCELED';

@Injectable()
export class RatingService {
  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly tradersService: TradersService,
  ) {}

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

  /**
   * Rate a trader (1-5 stars)
   */
  async rateTrader(
    userId: string,
    traderUsername: string,
    stars: number,
  ): Promise<void> {
    // Get trader by username
    const trader = await this.tradersService.findByUsername(traderUsername);

    // Check if user is trying to rate themselves
    if (trader.id === userId) {
      throw new BadRequestException('Cannot rate yourself');
    }

    // Validate stars
    if (stars < 1 || stars > 5) {
      throw new BadRequestException('Stars must be between 1 and 5');
    }

    // Check if already rated
    const { rows: existing } = await this.pool.query(
      `
      SELECT id FROM trader_stars
      WHERE user_id = $1 AND trader_id = $2
      LIMIT 1
      `,
      [userId, trader.id],
    );

    if (existing.length > 0) {
      // Update existing rating
      await this.pool.query(
        `
        UPDATE trader_stars
        SET stars = $1, updated_at = NOW()
        WHERE user_id = $2 AND trader_id = $3
        `,
        [stars, userId, trader.id],
      );
    } else {
      // Create new rating
      await this.pool.query(
        `
        INSERT INTO trader_stars (user_id, trader_id, stars)
        VALUES ($1, $2, $3)
        `,
        [userId, trader.id, stars],
      );
    }
  }

  /**
   * Get user's rating for a trader
   */
  async getMyTraderRating(
    userId: string,
    traderUsername: string,
  ): Promise<{ stars: number | null }> {
    // Get trader by username
    const trader = await this.tradersService.findByUsername(traderUsername);

    const { rows } = await this.pool.query(
      `
      SELECT stars FROM trader_stars
      WHERE user_id = $1 AND trader_id = $2
      LIMIT 1
      `,
      [userId, trader.id],
    );

    return {
      stars: rows[0]?.stars ? Number(rows[0].stars) : null,
    };
  }

  /**
   * Vote on a signal (like/dislike)
   */
  async voteSignal(
    userId: string,
    signalId: string,
    vote: VoteType,
  ): Promise<void> {
    // Check if signal exists
    const { rows: signalRows } = await this.pool.query(
      `SELECT id FROM signals WHERE id = $1 LIMIT 1`,
      [signalId],
    );

    if (!signalRows[0]) {
      throw new NotFoundException('Signal not found');
    }

    // Check if already voted
    const { rows: existing } = await this.pool.query(
      `
      SELECT id, vote FROM signal_votes
      WHERE user_id = $1 AND signal_id = $2
      LIMIT 1
      `,
      [userId, signalId],
    );

    if (existing.length > 0) {
      // Update existing vote
      await this.pool.query(
        `
        UPDATE signal_votes
        SET vote = $1, updated_at = NOW()
        WHERE user_id = $2 AND signal_id = $3
        `,
        [vote, userId, signalId],
      );
    } else {
      // Create new vote
      await this.pool.query(
        `
        INSERT INTO signal_votes (user_id, signal_id, vote)
        VALUES ($1, $2, $3)
        `,
        [userId, signalId, vote],
      );
    }
  }

  /**
   * Get user's vote for a signal
   */
  async getMySignalVote(
    userId: string,
    signalId: string,
  ): Promise<{ vote: VoteType | null }> {
    const { rows } = await this.pool.query(
      `
      SELECT vote FROM signal_votes
      WHERE user_id = $1 AND signal_id = $2
      LIMIT 1
      `,
      [userId, signalId],
    );

    return {
      vote: rows[0]?.vote || null,
    };
  }
}
