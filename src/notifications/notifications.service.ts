import { Inject, Injectable, Optional } from '@nestjs/common';
import { Pool } from 'pg';
import { TelegramNotificationProvider } from './providers/telegram.provider';
// import Redis from 'ioredis';

@Injectable()
export class NotificationsService {
  constructor(
    @Optional() @Inject('PG_POOL') private readonly pool: Pool,
    // @Inject('REDIS') private readonly redis: Redis,
    private readonly telegramProvider: TelegramNotificationProvider,
  ) {}

  async create(userId: string, type: string, message: string) {
    await this.pool.query(
      `
      INSERT INTO notifications (user_id, type, message)
      VALUES ($1, $2, $3)
      `,
      [userId, type, message],
    );

    // await this.redis.del(`notifications:unread:${userId}`);
    await this.telegramProvider.send(userId, message);
  }

  async list(userId: string) {
    // const cacheKey = `notifications:unread:${userId}`;

    // const cached = await this.redis.get(cacheKey);
    // if (cached) {
    //   return JSON.parse(cached);
    // }

    const { rows } = await this.pool.query(
      `
      SELECT * FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId],
    );

    // await this.redis.set(cacheKey, JSON.stringify(rows), 'EX', 15);

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
    // await this.redis.del(`notifications:unread:${userId}`);
  }
}
