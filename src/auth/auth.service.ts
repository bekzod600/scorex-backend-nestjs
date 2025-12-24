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
   * Called by bot webhook when user presses /start
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
   */
  async checkLoginStatus(loginId: string): Promise<{
    status: 'PENDING' | 'CONFIRMED' | 'EXPIRED';
    accessToken?: string;
    user?: any;
  }> {
    const { rows } = await this.pool.query(
      `
      SELECT pl.*, u.id as user_id, u.role, u.telegram_id, u.telegram_username
      FROM pending_logins pl
      LEFT JOIN users u ON pl.user_id = u.id
      WHERE pl.id = $1
      `,
      [loginId],
    );

    const login = rows[0];

    if (!login) {
      return { status: 'EXPIRED' };
    }

    // Check expiry
    if (login.status === 'PENDING' && new Date(login.expires_at) < new Date()) {
      await this.pool.query(
        `UPDATE pending_logins SET status = 'EXPIRED' WHERE id = $1`,
        [loginId],
      );
      return { status: 'EXPIRED' };
    }

    if (login.status === 'CONFIRMED') {
      const accessToken = this.signToken(login.user_id, login.role);
      return {
        status: 'CONFIRMED',
        accessToken,
        user: {
          id: login.user_id,
          telegramId: login.telegram_id,
          telegramUsername: login.telegram_username,
          role: login.role,
        },
      };
    }

    return { status: login.status };
  }

  // ========== HELPER METHODS ==========

  private async findUserByTelegramId(telegramId: number) {
    const { rows } = await this.pool.query(
      `
      SELECT id, telegram_id, telegram_username, telegram_first_name, 
             telegram_last_name, role, score_x
      FROM users
      WHERE telegram_id = $1
      `,
      [telegramId],
    );
    return rows[0] || null;
  }

  private async createTelegramUser(
    telegramId: number,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO users (
        telegram_id, telegram_username, telegram_first_name, 
        telegram_last_name, role, score_x
      )
      VALUES ($1, $2, $3, $4, 'user', 1000)
      RETURNING id, telegram_id, telegram_username, role, score_x
      `,
      [
        telegramId,
        telegramUsername || null,
        telegramFirstName || null,
        telegramLastName || null,
      ],
    );

    // Create wallet for new user
    await this.pool.query(
      `INSERT INTO wallets (user_id, balance) VALUES ($1, 0)`,
      [rows[0].id],
    );

    return rows[0];
  }

  private async updateTelegramInfo(
    userId: string,
    telegramUsername?: string,
    telegramFirstName?: string,
    telegramLastName?: string,
  ) {
    await this.pool.query(
      `
      UPDATE users
      SET telegram_username = $2,
          telegram_first_name = $3,
          telegram_last_name = $4,
          updated_at = NOW()
      WHERE id = $1
      `,
      [
        userId,
        telegramUsername || null,
        telegramFirstName || null,
        telegramLastName || null,
      ],
    );
  }

  private signToken(userId: string, role: string): string {
    const payload: JwtPayload = {
      sub: userId,
      role,
    };
    return this.jwtService.sign(payload);
  }

  // ========== LEGACY METHODS (DISABLED) ==========
  // These are kept for reference but should not be used

  /** @deprecated Use Telegram auth instead */
  register(): Promise<never> {
    throw new BadRequestException(
      'Email/password registration is disabled. Please use Telegram login.',
    );
  }

  /** @deprecated Use Telegram auth instead */
  login(): Promise<never> {
    throw new BadRequestException(
      'Email/password login is disabled. Please use Telegram login.',
    );
  }
}
