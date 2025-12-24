import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AuthService } from '../auth/auth.service';
// import { Inject } from '@nestjs/common';
import { Logger } from '@nestjs/common';

interface TelegramUpdate {
  message?: {
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    text?: string;
    chat: {
      id: number;
    };
  };
}

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegram: TelegramService,
    private readonly authService: AuthService,
  ) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: TelegramUpdate) {
    const message = update.message;
    if (!message?.text || !message.from) {
      return { ok: true };
    }

    const chatId = String(message.chat.id);
    const text: string = message.text;
    const telegramUser = message.from;

    console.log('telegram  is working!!!');

    // Handle /start command with login_id
    if (text.startsWith('/start')) {
      const parts = text.split(' ');

      if (parts.length === 1) {
        // No login_id provided - regular bot interaction
        await this.telegram.sendMessage(
          chatId,
          '👋 Welcome to ScoreX!\n\nTo login to the website, please initiate login from scorex.com',
        );
        return { ok: true };
      }

      const loginId = parts[1];

      try {
        // Confirm login via auth service
        const result = await this.authService.confirmTelegramLogin(
          loginId,
          telegramUser.id,
          telegramUser.username,
          telegramUser.first_name,
          telegramUser.last_name,
        );

        // Send success message
        await this.telegram.sendMessage(
          chatId,
          '✅ <b>Login Successful!</b>\n\n' +
            'You can now return to your browser. You should be automatically logged in.\n\n' +
            `User ID: <code>${result.user.id}</code>`,
        );

        this.logger.log(`Login confirmed for Telegram ID ${telegramUser.id}`);
      } catch (error) {
        this.logger.error(`Login confirmation failed: ${error.message}`);

        await this.telegram.sendMessage(
          chatId,
          '❌ <b>Login Failed</b>\n\n' +
            'This login link may have expired or is invalid.\n' +
            'Please try again from the website.',
        );
      }

      return { ok: true };
    }

    // Handle other commands
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

    // Default response
    await this.telegram.sendMessage(
      chatId,
      "I didn't understand that command. Use /help to see available commands.",
    );

    return { ok: true };
  }
}
