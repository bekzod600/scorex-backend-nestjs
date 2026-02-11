import {
  Body,
  Controller,
  Post,
  Get,
  Delete,
  Query,
  HttpCode,
  UsePipes,
  Logger,
} from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AuthService } from '../auth/auth.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly authService: AuthService,
  ) {}

  // ══════════════════════════════════════════════
  //  WEBHOOK ENDPOINT — Telegram updatelar qabul qilish
  // ══════════════════════════════════════════════

  @Post('webhook')
  @HttpCode(200)
  @UsePipes() // Global ValidationPipe ni o'chiradi — Telegram har xil fieldlar yuboradi
  async webhook(@Body() update: Record<string, any>) {
    const message = update.message;

    // Faqat text xabarlarni handle qilamiz
    if (!message?.text || !message.from) {
      return { ok: true };
    }

    const chatId = String(message.chat.id);
    const text: string = message.text;
    const telegramUser = message.from;

    this.logger.log(
      `📩 Message from @${telegramUser.username || telegramUser.id}: ${text}`,
    );

    // ── /start command ──
    if (text.startsWith('/start')) {
      const parts = text.split(' ');

      if (parts.length === 1) {
        // login_id yo'q — oddiy start
        await this.telegram.sendMessage(
          chatId,
          '👋 Welcome to ScoreX!\n\n' +
            'To login to the website, please initiate login from scorex.com',
        );
        return { ok: true };
      }

      // login_id bor — autentifikatsiya
      const loginId = parts[1];

      try {
        const result = await this.authService.confirmTelegramLogin(
          loginId,
          telegramUser.id,
          telegramUser.username,
          telegramUser.first_name,
          telegramUser.last_name,
        );

        await this.telegram.sendMessage(
          chatId,
          '✅ <b>Login Successful!</b>\n\n' +
            'You can now return to your browser. You should be automatically logged in.\n\n' +
            `User ID: <code>${result.user.id}</code>`,
        );

        this.logger.log(
          `✅ Login confirmed for Telegram ID ${telegramUser.id}`,
        );
      } catch (error) {
        this.logger.error(`❌ Login failed: ${error.message}`);

        await this.telegram.sendMessage(
          chatId,
          '❌ <b>Login Failed</b>\n\n' +
            'This login link may have expired or is invalid.\n' +
            'Please try again from the website.',
        );
      }

      return { ok: true };
    }

    // ── /help command ──
    if (text === '/help') {
      await this.telegram.sendMessage(
        chatId,
        '🤖 <b>ScoreX Bot Commands</b>\n\n' +
          '/start - Begin login process\n' +
          '/help - Show this message\n\n' +
          'To login, visit scorex.com and click "Login with Telegram"',
      );
      return { ok: true };
    }

    // ── /webapp command ──
    if (text === '/webapp') {
      await this.telegram.sendMessage(
        chatId,
        '📱 Open the app using the menu button below, or visit:\nhttps://v0-score-x-trading-ui.vercel.app/',
      );
      return { ok: true };
    }

    // ── Noma'lum command ──
    await this.telegram.sendMessage(
      chatId,
      "I didn't understand that command. Use /help to see available commands.",
    );

    return { ok: true };
  }

  // ══════════════════════════════════════════════
  //  WEBHOOK MANAGEMENT — qo'shish / o'chirish / holat
  // ══════════════════════════════════════════════

  /**
   * Webhook o'rnatish
   * POST /telegram/webhook/set?url=https://xxx.ngrok-free.app/telegram/webhook
   */
  @Post('webhook/set')
  @HttpCode(200)
  async setWebhook(@Query('url') url: string) {
    if (!url) {
      return { ok: false, error: 'url query parameter required' };
    }

    try {
      await this.telegram.setWebhook(url);
      const info = await this.telegram.getWebhookInfo();
      return {
        ok: true,
        message: `Webhook set to: ${url}`,
        webhook: {
          url: info.url,
          pending_update_count: info.pending_update_count,
          last_error_message: info.last_error_message || null,
        },
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Webhook o'chirish
   * DELETE /telegram/webhook
   */
  @Delete('webhook')
  @HttpCode(200)
  deleteWebhook() {
    try {
      this.telegram.deleteWebhook();
      return { ok: true, message: 'Webhook deleted' };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  /**
   * Webhook holati
   * GET /telegram/webhook/info
   */
  @Get('webhook/info')
  async getWebhookInfo() {
    try {
      const info = await this.telegram.getWebhookInfo();
      return {
        ok: true,
        webhook: {
          url: info.url || 'Not set',
          has_custom_certificate: info.has_custom_certificate,
          pending_update_count: info.pending_update_count,
          last_error_date: info.last_error_date || null,
          last_error_message: info.last_error_message || null,
          max_connections: info.max_connections,
        },
      };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}
