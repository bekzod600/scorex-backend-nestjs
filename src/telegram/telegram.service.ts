import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly bot: TelegramBot;
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {
    this.bot = new TelegramBot(
      this.config.get<string>('TELEGRAM_BOT_TOKEN')!,
      { polling: false }, // NestJS o'zi webhook handle qiladi, kutubxona emas
    );
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  async sendMessage(chatId: string, text: string) {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }

  /**
   * Webhook o'rnatish
   * @param url - ngrok yoki production URL, masalan: https://xxx.ngrok-free.app/telegram/webhook
   */
  async setWebhook(url: string): Promise<void> {
    await this.bot.setWebHook(url);
    this.logger.log(`✅ Webhook set: ${url}`);
  }

  /**
   * Webhook o'chirish
   */
  async deleteWebhook(): Promise<void> {
    await this.bot.deleteWebHook();
    this.logger.log('✅ Webhook deleted');
  }

  /**
   * Webhook holati
   */
  getWebhookInfo(): TelegramBot.WebhookInfo {
    return this.bot.getWebHookInfo();
  }
}
