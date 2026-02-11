import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import type {
  TelegramLoginResponse,
  LoginConfirmedResponse,
} from './dto/telegram-auth.dto';

interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly LOGIN_EXPIRY_SECONDS = 120; // 2 minutes
  private readonly botUsername: string;

  constructor(
    @Inject('PG_POOL') private readonly pool: Pool,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.botUsername =
      this.config.get<string>('TELEGRAM_BOT_USERNAME') || 'your_bot';
  }

  // ==========================================
  // WEBSITE LOGIN METHODS (Mavjud)
  // ==========================================

  /**
   * Step 1: Website initiates login
   * Creates a pending login session and returns deep link
   */
  async initiateTelegramLogin(): Promise<TelegramLoginResponse> {
    const loginId = uuidv4();
    const expiresAt = new Date(Date.now() + this.LOGIN_EXPIRY_SECONDS * 1000);

    await this.pool.query(
      `
      INSERT INTO pending_logins (id, status, expires_at)
      VALUES ($1, 'PENDING', $2)
      `,
      [loginId, expiresAt],
    );

    const deepLink = `https://t.me/${this.botUsername}?start=${loginId}`;

    return {
      loginId,
      botUsername: this.botUsername,
      deepLink,
      expiresIn: this.LOGIN_EXPIRY_SECONDS,
    };
  }

  /**
   * Step 2: Telegram bot confirms login
   * Called by bot webhook when user presses /start with loginId
   */
  async confirmTelegramLogin(
    loginId: string,
    telegramId: number,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ): Promise<LoginConfirmedResponse> {
    await this.pool.query('BEGIN');

    try {
      // 1. Validate pending login
      const { rows: pendingRows } = await this.pool.query(
        `
        SELECT * FROM pending_logins
        WHERE id = $1 AND status = 'PENDING'
        FOR UPDATE
        `,
        [loginId],
      );

      const pending = pendingRows[0];

      if (!pending) {
        throw new UnauthorizedException('Invalid or expired login session');
      }

      // Check expiry
      if (new Date(pending.expires_at) < new Date()) {
        await this.pool.query(
          `UPDATE pending_logins SET status = 'EXPIRED' WHERE id = $1`,
          [loginId],
        );
        throw new UnauthorizedException('Login session expired');
      }

      // 2. Find or create user
      let user = await this.findUserByTelegramId(telegramId);

      if (!user) {
        user = await this.createTelegramUser(
          telegramId,
          telegramUsername,
          telegramFirstName,
          telegramLastName,
        );
      } else {
        // Update Telegram info if changed
        await this.updateTelegramInfo(
          user.id,
          telegramUsername,
          telegramFirstName,
          telegramLastName,
        );
      }

      // 3. Mark login as confirmed
      await this.pool.query(
        `
        UPDATE pending_logins
        SET status = 'CONFIRMED',
            telegram_id = $2,
            user_id = $3,
            confirmed_at = NOW()
        WHERE id = $1
        `,
        [loginId, telegramId, user.id],
      );

      await this.pool.query('COMMIT');

      // 4. Generate JWT
      const accessToken = this.signToken(user.id, user.role);

      return {
        success: true,
        accessToken,
        user: {
          id: user.id,
          telegramId: user.telegram_id,
          telegramUsername: user.telegram_username,
          role: user.role,
        },
      };
    } catch (err) {
      await this.pool.query('ROLLBACK');
      throw err;
    }
  }

  /**
   * Check login status (for polling if WebSocket not used)
   * FIXED: user_id va user ma'lumotlaridan to'g'ri foydalanish
   */
  async checkLoginStatus(loginId: string): Promise<{
    status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
    accessToken?: string;
    user?: any;
  }> {
    const { rows } = await this.pool.query(
      `
      SELECT pl.status, pl.user_id, pl.expires_at,
       u.id AS uid, u.telegram_id, u.telegram_username, u.role
      FROM pending_logins pl
      LEFT JOIN users u ON u.id = pl.user_id
      WHERE pl.id = $1
      `,
      [loginId],
    );

    const pending = rows[0];

    if (!pending) {
      return { status: 'EXPIRED' };
    }

    // Check if expired
    if (
      pending.status === 'PENDING' &&
      new Date(pending.expires_at) < new Date()
    ) {
      await this.pool.query(
        `UPDATE pending_logins SET status = 'EXPIRED' WHERE id = $1`,
        [loginId],
      );
      return { status: 'EXPIRED' };
    }

    if (pending.status === 'CONFIRMED' && pending.user_id) {
      // FIXED: user_id va user jadvalidan ma'lumotlar ishlatiladi
      const accessToken = this.signToken(pending.uid, pending.role);
      return {
        status: 'CONFIRMED',
        accessToken,
        user: {
          id: pending.uid,
          telegramId: pending.telegram_id,
          telegramUsername: pending.telegram_username,
          role: pending.role,
        },
      };
    }

    return { status: pending.status };
  }

  // ==========================================
  // TELEGRAM WEBAPP METHODS (Yangi)
  // ==========================================

  /**
   * Telegram Web App initData ni tekshirish va JWT qaytarish
   * Bu Telegram Mini App ichidan auth qilish uchun ishlatiladi
   *
   * @param initData - window.Telegram.WebApp.initData dan keladi
   */
  async validateWebAppInitData(
    initData: string,
  ): Promise<LoginConfirmedResponse> {
    // 1. initData ni parse qilish
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    params.delete('hash');

    if (!hash) {
      throw new UnauthorizedException('Invalid initData: missing hash');
    }

    // 2. Data check string yaratish (sorted key=value pairs)
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // 3. Secret key yaratish
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new BadRequestException('Bot token not configured');
    }

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    // 4. Hash ni tekshirish
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      throw new UnauthorizedException('Invalid initData: hash mismatch');
    }

    // 5. auth_date ni tekshirish (5 daqiqadan eski bo'lmasligi kerak)
    const authDate = parseInt(params.get('auth_date') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    const WEBAPP_AUTH_EXPIRY_SECONDS = 86400; // 5 daqiqa

    if (now - authDate > WEBAPP_AUTH_EXPIRY_SECONDS) {
      throw new UnauthorizedException('InitData expired');
    }

    // 6. User ma'lumotlarini olish
    const userJson = params.get('user');
    if (!userJson) {
      throw new UnauthorizedException('Invalid initData: missing user');
    }

    let telegramUser: any;
    try {
      telegramUser = JSON.parse(userJson);
    } catch {
      throw new UnauthorizedException('Invalid initData: malformed user JSON');
    }

    if (!telegramUser.id) {
      throw new UnauthorizedException('Invalid initData: missing user id');
    }

    // 7. Userni bazadan topish yoki yaratish
    let user = await this.findUserByTelegramId(telegramUser.id);

    if (!user) {
      user = await this.createTelegramUser(
        telegramUser.id,
        telegramUser.username,
        telegramUser.first_name,
        telegramUser.last_name,
      );
    } else {
      // Ma'lumotlarni yangilash
      await this.updateTelegramInfo(
        user.id,
        telegramUser.username,
        telegramUser.first_name,
        telegramUser.last_name,
      );
    }

    // 8. JWT token yaratish
    const accessToken = this.signToken(user.id, user.role);

    return {
      success: true,
      accessToken,
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        telegramUsername: user.telegram_username,
        role: user.role,
      },
    };
  }

  /**
   * /start buyrug'ida userni avtomatik ro'yxatdan o'tkazish
   * loginId bo'lmasa ham ishlaydi - WebApp uchun kerak
   */
  async autoRegisterTelegramUser(
    telegramId: number,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ): Promise<{ user: any; accessToken: string; isNew: boolean }> {
    let user = await this.findUserByTelegramId(telegramId);
    let isNew = false;

    if (!user) {
      user = await this.createTelegramUser(
        telegramId,
        telegramUsername,
        telegramFirstName,
        telegramLastName,
      );
      isNew = true;
    } else {
      // Mavjud user ma'lumotlarini yangilash
      await this.updateTelegramInfo(
        user.id,
        telegramUsername,
        telegramFirstName,
        telegramLastName,
      );
    }

    const accessToken = this.signToken(user.id, user.role);

    return {
      user: {
        id: user.id,
        telegramId: user.telegram_id,
        telegramUsername: user.telegram_username,
        role: user.role,
      },
      accessToken,
      isNew,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private signToken(userId: string, role: string): string {
    const payload: JwtPayload = { sub: userId, role };
    return this.jwtService.sign(payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  async findUserByTelegramId(telegramId: number): Promise<any | null> {
    const { rows } = await this.pool.query(
      `SELECT * FROM users WHERE telegram_id = $1`,
      [telegramId],
    );
    return rows[0] || null;
  }

  private async createTelegramUser(
    telegramId: number,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ): Promise<any> {
    const { rows } = await this.pool.query(
      `
      INSERT INTO users (telegram_id, telegram_username, telegram_first_name, telegram_last_name, role)
      VALUES ($1, $2, $3, $4, 'USER')
      RETURNING *
      `,
      [telegramId, telegramUsername, telegramFirstName, telegramLastName],
    );
    return rows[0];
  }

  private async updateTelegramInfo(
    userId: string,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ): Promise<void> {
    await this.pool.query(
      `
      UPDATE users
      SET telegram_username = COALESCE($2, telegram_username),
          telegram_first_name = COALESCE($3, telegram_first_name),
          telegram_last_name = COALESCE($4, telegram_last_name),
          updated_at = NOW()
      WHERE id = $1
      `,
      [userId, telegramUsername, telegramFirstName, telegramLastName],
    );
  }

  // ==========================================
  // LEGACY METHODS (Disabled)
  // ==========================================

  register() {
    return {
      message: 'Email/password registration is disabled. Use Telegram.',
    };
  }

  login() {
    return { message: 'Email/password login is disabled. Use Telegram.' };
  }
}
