import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class AdminService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // USERS
  async listUsers() {
    const { rows } = await this.pool.query(
      `SELECT id,email,role,score_x,is_premium FROM users ORDER BY created_at DESC`,
    );
    return rows;
  }

  // TRAINING CENTERS
  async listTrainingCenters() {
    const { rows } = await this.pool.query(
      `SELECT * FROM training_centers ORDER BY created_at DESC`,
    );
    return rows;
  }

  async approveTrainingCenter(id: string) {
    await this.pool.query(
      `UPDATE training_centers SET status='approved' WHERE id=$1`,
      [id],
    );
  }

  async rejectTrainingCenter(id: string) {
    await this.pool.query(
      `UPDATE training_centers SET status='rejected' WHERE id=$1`,
      [id],
    );
  }

  // P2P TOPUPS
  async listP2pTopups() {
    const { rows } = await this.pool.query(
      `SELECT * FROM p2p_topups WHERE status='pending' ORDER BY created_at DESC`,
    );
    return rows;
  }

  async approveP2pTopup(id: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM p2p_topups WHERE id=$1`,
      [id],
    );
    const topup = rows[0];
    if (!topup) return;

    await this.pool.query('BEGIN');
    try {
      await this.pool.query(
        `UPDATE p2p_topups SET status='approved', reviewed_at=NOW() WHERE id=$1`,
        [id],
      );

      await this.pool.query(
        `
        UPDATE wallets
        SET balance = balance + $1, updated_at = NOW()
        WHERE user_id = $2
        `,
        [topup.amount, topup.user_id],
      );

      await this.pool.query('COMMIT');
    } catch (e) {
      await this.pool.query('ROLLBACK');
      throw e;
    }
  }

  async rejectP2pTopup(id: string, note?: string) {
    await this.pool.query(
      `
      UPDATE p2p_topups
      SET status='rejected', admin_note=$2, reviewed_at=NOW()
      WHERE id=$1
      `,
      [id, note ?? null],
    );
  }

  // SIGNALS
  async forceCancelSignal(id: string) {
    await this.pool.query(
      `UPDATE signals SET status='CANCELED', closed_at=NOW() WHERE id=$1`,
      [id],
    );
  }
}
