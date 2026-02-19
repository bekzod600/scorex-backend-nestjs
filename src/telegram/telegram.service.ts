import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramService {
  private readonly bot: TelegramBot;
  private readonly logger = new Logger(TelegramService.name);
  private readonly webAppUrl: string;

  constructor(private readonly config: ConfigService) {
    this.bot = new TelegramBot(this.config.get<string>('TELEGRAM_BOT_TOKEN')!, {
      polling: false,
    });
    this.webAppUrl =
      this.config.get<string>('WEBAPP_URL') ||
      'https://v0-score-x-trading-ui.vercel.app/';
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  /**
   * Oddiy text xabar yuborish
   */
  async sendMessage(chatId: string, text: string) {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
    });
  }

  /**
   * WebApp tugmali xabar yuborish
   * Telegram Mini App ochish uchun inline keyboard bilan
   */
  async sendMessageWithWebApp(
    chatId: string,
    text: string,
    buttonText: string = '📱 Open ScoreX',
    webAppUrl?: string,
  ) {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: buttonText,
              web_app: { url: webAppUrl || this.webAppUrl },
            },
          ],
        ],
      },
    });
  }

  /**
   * Inline keyboard tugmali xabar yuborish (umumiy)
   */
  async sendMessageWithButtons(
    chatId: string,
    text: string,
    buttons: Array<
      Array<{ text: string; url?: string; web_app?: { url: string } }>
    >,
  ) {
    await this.bot.sendMessage(chatId, text, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons,
      },
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
