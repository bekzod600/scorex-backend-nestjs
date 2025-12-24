import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly bot: TelegramBot;

  constructor(private readonly config: ConfigService) {
    this.bot = new TelegramBot(this.config.get<string>('TELEGRAM_BOT_TOKEN')!, {
      webHook: true,
    });
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  async sendMessage(chatId: string, text: string) {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }
}
