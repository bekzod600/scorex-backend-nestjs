import { Body, Controller, Post, HttpCode } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { AuthService } from '../auth/auth.service';
import { ConfigService } from '@nestjs/config';
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
  // WebApp button bosilganda callback_query keladi
  callback_query?: {
    from: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
    };
    data?: string;
  };
}

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);
  private readonly webAppUrl: string;

  constructor(
    private readonly telegram: TelegramService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {
    // WebApp URL ni .env dan olish
    this.webAppUrl =
      this.config.get<string>('WEBAPP_URL') || 'https://your-app.com';
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Body() update: TelegramUpdate) {
    // Callback query (inline button)
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    // Regular message
    const message = update.message;
    if (!message?.text || !message.from) {
      return { ok: true };
    }

    const chatId = String(message.chat.id);
    const text: string = message.text;
    const telegramUser = message.from;

    this.logger.log(
      `Received: "${text}" from user ${telegramUser.id} (@${telegramUser.username || 'no_username'})`,
    );

    // ==========================================
    // /start COMMAND
    // ==========================================
    if (text.startsWith('/start')) {
      const parts = text.split(' ');

      // /start LOGIN_ID - Website login uchun
      if (parts.length > 1) {
        const loginId = parts[1];
        return this.handleWebsiteLogin(chatId, loginId, telegramUser);
      }

      // /start (parametrsiz) - Auto register va WebApp button
      return this.handleAutoRegisterAndShowWebApp(chatId, telegramUser);
    }

    // ==========================================
    // /help COMMAND
    // ==========================================
    if (text === '/help') {
      await this.telegram.sendMessage(
        chatId,
        '🤖 <b>ScoreX Bot</b>\n\n' +
          '<b>Buyruqlar:</b>\n' +
          '/start - Ilovani ochish\n' +
          '/help - Yordam\n\n' +
          'Ilovani ochish uchun quyidagi tugmani bosing yoki /start yozing 👇',
      );

      // Help xabaridan keyin ham WebApp tugmasini ko'rsatamiz
      await this.telegram.sendMessageWithWebApp(
        chatId,
        '📱 ScoreX ilovasiga kirish:',
        this.webAppUrl,
        '🚀 Ilovani ochish',
      );

      return { ok: true };
    }

    // ==========================================
    // /webapp COMMAND - Direct WebApp ochish
    // ==========================================
    if (text === '/webapp' || text === '/app') {
      await this.telegram.sendMessageWithWebApp(
        chatId,
        '📱 ScoreX ilovasini ochish uchun quyidagi tugmani bosing:',
        this.webAppUrl,
        '🚀 Ilovani ochish',
      );
      return { ok: true };
    }

    // ==========================================
    // DEFAULT RESPONSE
    // ==========================================
    await this.telegram.sendMessage(
      chatId,
      'Bu buyruqni tushunmadim 🤔\n\n' +
        'Mavjud buyruqlar:\n' +
        '/start - Ilovani ochish\n' +
        '/help - Yordam',
    );

    return { ok: true };
  }

  /**
   * Callback query handler (inline buttons uchun)
   */
  private handleCallbackQuery(callbackQuery: any) {
    // Hozircha WebApp button callback_query bermaydi
    // Lekin kelajakda kerak bo'lishi mumkin
    this.logger.log(
      `Callback query from ${callbackQuery.from.id}: ${callbackQuery.data}`,
    );
    return { ok: true };
  }

  /**
   * Website login uchun - mavjud funksionallik
   * User website dan /start LOGIN_ID link orqali keladi
   */
  private async handleWebsiteLogin(
    chatId: string,
    loginId: string,
    telegramUser: any,
  ) {
    this.logger.log(
      `Website login attempt: loginId=${loginId}, userId=${telegramUser.id}`,
    );

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
        '✅ <b>Muvaffaqiyatli kirdingiz!</b>\n\n' +
          'Brauzerga qaytishingiz mumkin - avtomatik kirish amalga oshdi.\n\n' +
          `👤 User ID: <code>${result.user.id}</code>`,
      );

      this.logger.log(
        `Website login SUCCESS for Telegram ID ${telegramUser.id}`,
      );
    } catch (error) {
      this.logger.error(`Website login FAILED: ${error.message}`);

      await this.telegram.sendMessage(
        chatId,
        '❌ <b>Xatolik!</b>\n\n' +
          "Bu login havolasi eskirgan yoki noto'g'ri.\n\n" +
          'Iltimos, websitedan qaytadan <b>"Login with Telegram"</b> tugmasini bosing.',
      );
    }

    return { ok: true };
  }

  /**
   * Auto register va WebApp tugmasini ko'rsatish
   * User oddiy /start buyrug'i bersa (parametrsiz)
   */
  private async handleAutoRegisterAndShowWebApp(
    chatId: string,
    telegramUser: any,
  ) {
    this.logger.log(
      `Auto register attempt for user ${telegramUser.id} (@${telegramUser.username || 'no_username'})`,
    );

    try {
      // 1. Userni avtomatik ro'yxatdan o'tkazish (yoki mavjudini topish)
      const result = await this.authService.autoRegisterTelegramUser(
        telegramUser.id,
        telegramUser.username,
        telegramUser.first_name,
        telegramUser.last_name,
      );

      // 2. Welcome xabari tayyorlash
      const firstName = telegramUser.first_name || "do'stim";
      let welcomeMessage: string;
      if (result.isNew) {
        welcomeMessage =
          `🎉 <b>Xush kelibsiz, ${firstName}!</b>\n\n` +
          "✅ Siz muvaffaqiyatli ro'yxatdan o'tdingiz!\n\n" +
          'ScoreX - professional trading signallari platformasi. ' +
          'Ilovani ochish uchun quyidagi tugmani bosing 👇';

        this.logger.log(`NEW user registered: ${telegramUser.id}`);
      } else {
        welcomeMessage =
          `👋 <b>Qaytganingizdan xursandmiz, ${firstName}!</b>\n\n` +
          'Ilovani ochish uchun quyidagi tugmani bosing 👇';

        this.logger.log(`Existing user welcomed: ${telegramUser.id}`);
      }

      // 3. WebApp tugmasi bilan xabar yuborish
      await this.telegram.sendMessageWithWebApp(
        chatId,
        welcomeMessage,
        this.webAppUrl,
        "📱 ScoreX'ni ochish",
      );
    } catch (error) {
      this.logger.error(
        `Auto register FAILED for ${telegramUser.id}: ${error.message}`,
      );

      await this.telegram.sendMessage(
        chatId,
        '❌ <b>Xatolik yuz berdi</b>\n\n' +
          "Iltimos, bir ozdan keyin qaytadan /start buyrug'ini yuboring.\n\n" +
          'Muammo davom etsa, @support_username ga murojaat qiling.',
      );
    }

    return { ok: true };
  }
}
