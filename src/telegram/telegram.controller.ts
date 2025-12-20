import { Body, Controller, Post } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';

@Controller('telegram')
export class TelegramController {
  constructor(
    private readonly telegram: TelegramService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  @Post('webhook')
  async webhook(@Body() update: any) {
    const message = update.message;
    if (!message?.text) return { ok: true };

    const chatId = String(message.chat.id);
    const text: string = message.text;

    // /start <token>
    if (text.startsWith('/start')) {
      const [, token] = text.split(' ');
      if (!token) {
        await this.telegram.sendMessage(
          chatId,
          'Please connect via website first.',
        );
        return { ok: true };
      }

      // token = userId for now (later JWT or temp token)
      await this.pool.query(
        `
        UPDATE users
        SET telegram_chat_id = $1
        WHERE id = $2
        `,
        [chatId, token],
      );

      await this.telegram.sendMessage(
        chatId,
        '✅ Telegram successfully connected to ScoreX.',
      );
    }

    return { ok: true };
  }
}
