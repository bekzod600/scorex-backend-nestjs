import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class NotificationsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async create(userId: string, type: string, message: string) {
    await this.pool.query(
      `
      INSERT INTO notifications (user_id, type, message)
      VALUES ($1, $2, $3)
      `,
      [userId, type, message],
    );
  }

  async list(userId: string) {
    const { rows } = await this.pool.query(
      `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId],
    );
    return rows;
  }

  async markRead(id: string, userId: string) {
    await this.pool.query(
      `
      UPDATE notifications
      SET is_read = true
      WHERE id = $1 AND user_id = $2
      `,
      [id, userId],
    );
  }
}
