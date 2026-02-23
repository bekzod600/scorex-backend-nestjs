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
  @UsePipes()
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
        // login_id yo'q — WebApp tugmasi bilan welcome xabar
        try {
          await this.telegram.sendMessageWithWebApp(
            chatId,
            '👋 <b>Welcome to ScoreX!</b>\n\n' +
              '📊 Professional halal stock signals marketplace.\n\n' +
              '👇 Tap the button below to open the app:',
            '📱 Open ScoreX',
          );
        } catch (err) {
          this.logger.warn(`⚠️ Failed to send welcome to ${chatId}: ${err?.message || err}`);
        }
        return { ok: true };
      }

      // login_id bor — website autentifikatsiya
      const loginId = parts[1];

      try {
        const result = await this.authService.confirmTelegramLogin(
          loginId,
          telegramUser.id,
          telegramUser.username,
          telegramUser.first_name,
          telegramUser.last_name,
        );

        try {
          await this.telegram.sendMessageWithWebApp(
            chatId,
            '✅ <b>Login Successful!</b>\n\n' +
              'You are now logged in. You can return to your browser or open the app below.\n\n' +
              `User ID: <code>${result.user.id}</code>`,
            '📱 Open ScoreX',
          );
        } catch (sendErr) {
          this.logger.warn(`⚠️ Failed to send success msg to ${chatId}: ${sendErr?.message || sendErr}`);
        }

        this.logger.log(
          `✅ Login confirmed for Telegram ID ${telegramUser.id}`,
        );
      } catch (error) {
        this.logger.error(`❌ Login failed: ${error.message}`);

        try {
          await this.telegram.sendMessageWithWebApp(
            chatId,
            '❌ <b>Login Failed</b>\n\n' +
              'This login link may have expired or is invalid.\n' +
              'Please try again, or open the app directly:',
            '📱 Open ScoreX',
          );
        } catch (sendErr) {
          this.logger.warn(`⚠️ Failed to send error msg to ${chatId}: ${sendErr?.message || sendErr}`);
        }
      }

      return { ok: true };
    }

    // ── /help command ──
    if (text === '/help') {
      try {
        await this.telegram.sendMessageWithWebApp(
          chatId,
          '🤖 <b>ScoreX Bot Commands</b>\n\n' +
            '/start - Welcome message & open app\n' +
            '/help - Show this message\n' +
            '/webapp - Open the trading app\n\n' +
            '👇 Tap the button to open ScoreX:',
          '📱 Open ScoreX',
        );
      } catch (err) {
        this.logger.warn(`⚠️ Failed to send help to ${chatId}: ${err?.message || err}`);
      }
      return { ok: true };
    }

    // ── /webapp command ──
    if (text === '/webapp') {
      try {
        await this.telegram.sendMessageWithWebApp(
          chatId,
          '📱 <b>Open ScoreX App</b>\n\n' +
            'Tap the button below to open the trading app:',
          '📱 Open ScoreX',
        );
      } catch (err) {
        this.logger.warn(`⚠️ Failed to send webapp to ${chatId}: ${err?.message || err}`);
      }
      return { ok: true };
    }

    // ── Noma'lum command ──
    try {
      await this.telegram.sendMessageWithWebApp(
        chatId,
        "I didn't understand that command.\n\n" +
          'Use /help to see available commands, or open the app:',
        '📱 Open ScoreX',
      );
    } catch (err) {
      this.logger.warn(`⚠️ Failed to send unknown cmd msg to ${chatId}: ${err?.message || err}`);
    }

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
