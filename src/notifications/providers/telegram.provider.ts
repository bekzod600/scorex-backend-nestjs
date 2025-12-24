import { Injectable } from '@nestjs/common';
import { TelegramService } from '../../telegram/telegram.service';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Injectable()
export class TelegramNotificationProvider {
  constructor(
    private readonly telegram: TelegramService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  async send(userId: string, message: string) {
    const { rows } = await this.pool.query(
      `SELECT telegram_chat_id FROM users WHERE id = $1`,
      [userId],
    );

    const chatId = rows[0]?.telegram_chat_id as string;
    if (!chatId) return;

    await this.telegram.sendMessage(chatId, message);
  }
}
