import { Injectable, OnModuleInit } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly bot: TelegramBot;
  private readonly logger = new Logger(TelegramService.name);
  private readonly webAppUrl: string;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');

    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set in environment');
    }

    this.bot = new TelegramBot(token, {
      webHook: true,
    });

    this.webAppUrl = this.config.get<string>('WEBAPP_URL') || '';
  }

  /**
   * Module init da bot menu button ni sozlash
   */
  async onModuleInit() {
    if (this.webAppUrl) {
      try {
        await this.setMenuButton(this.webAppUrl);
        this.logger.log(`Bot menu button set to WebApp: ${this.webAppUrl}`);
      } catch (error) {
        this.logger.warn(`Failed to set menu button: ${error.message}`);
      }
    }
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  /**
   * Oddiy text xabar yuborish
   */
  async sendMessage(chatId: string, text: string): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(
        `Failed to send message to ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * WebApp tugmasi bilan xabar yuborish
   * Telegram Mini App ochish uchun inline button
   */
  async sendMessageWithWebApp(
    chatId: string,
    text: string,
    webAppUrl: string,
    buttonText: string = '📱 Open App',
  ): Promise<void> {
    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: buttonText,
                web_app: { url: webAppUrl },
              },
            ],
          ],
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send WebApp message to ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Bir nechta tugma bilan xabar yuborish
   * Masalan: WebApp + Website link
   */
  async sendMessageWithButtons(
    chatId: string,
    text: string,
    buttons: Array<{
      text: string;
      webApp?: string; // WebApp URL
      url?: string; // Regular URL
      callback?: string; // Callback data
    }>,
  ): Promise<void> {
    const keyboard = buttons.map((btn) => {
      if (btn.webApp) {
        return [{ text: btn.text, web_app: { url: btn.webApp } }];
      } else if (btn.url) {
        return [{ text: btn.text, url: btn.url }];
      } else if (btn.callback) {
        return [{ text: btn.text, callback_data: btn.callback }];
      }
      return [{ text: btn.text, callback_data: 'noop' }];
    });

    try {
      await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: keyboard,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to send buttons message to ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Bot menu button ni WebApp ga sozlash
   * Bu barcha userlar uchun global sozlama
   * Telegram ilovasida chat ochilganda "Menu" tugmasi WebApp ochadi
   */
  async setMenuButton(webAppUrl: string): Promise<void> {
    try {
      await this.bot.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '📱 Open App',
          web_app: { url: webAppUrl },
        },
      });
      this.logger.log('Menu button configured successfully');
    } catch (error) {
      this.logger.error(`Failed to set menu button: ${error.message}`);
      throw error;
    }
  }

  /**
   * Muayyan user uchun menu button sozlash
   */
  async setUserMenuButton(chatId: number, webAppUrl: string): Promise<void> {
    try {
      await this.bot.setChatMenuButton({
        chat_id: chatId,
        menu_button: {
          type: 'web_app',
          text: '📱 Open App',
          web_app: { url: webAppUrl },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to set user menu button for ${chatId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Bot commands ro'yxatini sozlash
   */
  async setCommands(): Promise<void> {
    try {
      await this.bot.setMyCommands([
        { command: 'start', description: 'Ilovani ochish' },
        { command: 'help', description: 'Yordam' },
        { command: 'webapp', description: 'WebApp ochish' },
      ]);
      this.logger.log('Bot commands configured');
    } catch (error) {
      this.logger.error(`Failed to set commands: ${error.message}`);
    }
  }

  /**
   * Webhook URL ni sozlash
   * Production deploy vaqtida bir marta chaqiriladi
   */
  async setWebhook(webhookUrl: string): Promise<void> {
    try {
      await this.bot.setWebHook(webhookUrl);
      this.logger.log(`Webhook set to: ${webhookUrl}`);
    } catch (error) {
      this.logger.error(`Failed to set webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Webhook ma'lumotlarini olish
   */
  getWebhookInfo(): TelegramBot.WebhookInfo {
    return this.bot.getWebHookInfo();
  }
}
