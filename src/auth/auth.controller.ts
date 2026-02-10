import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ConfirmTelegramLoginDto } from './dto/telegram-auth.dto';
import { TelegramWebAppAuthDto } from './dto/telegram-webapp.dto';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';
import { AuthWebSocketGateway } from './auth-websocket.gateway';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authGateway: AuthWebSocketGateway,
  ) {}

  // ==========================================
  // WEBSITE LOGIN ENDPOINTS
  // ==========================================

  /**
   * Step 1: Initiate Telegram login (Website)
   * Website calls this to get a login_id and deep link
   *
   * POST /auth/telegram/initiate
   * Response: { loginId, botUsername, deepLink, expiresIn }
   */
  @Throttle({ default: { limit: 10, ttl: 60 } })
  @Post('telegram/initiate')
  async initiateTelegramLogin() {
    return this.authService.initiateTelegramLogin();
  }

  /**
   * Step 2: Confirm Telegram login (called by bot webhook)
   * Bot webhook calls this after user presses /start with loginId
   *
   * POST /auth/telegram/confirm
   * Body: { loginId, telegramId, telegramUsername?, ... }
   * Response: { success, accessToken, user }
   */
  @Throttle({ default: { limit: 20, ttl: 60 } })
  @Post('telegram/confirm')
  async confirmTelegramLogin(@Body() dto: ConfirmTelegramLoginDto) {
    const result = await this.authService.confirmTelegramLogin(
      dto.loginId,
      dto.telegramId,
      dto.telegramUsername,
      dto.telegramFirstName,
      dto.telegramLastName,
    );

    // Notify WebSocket clients
    this.authGateway.notifyLoginConfirmed({
      loginId: dto.loginId,
      accessToken: result.accessToken,
      user: result.user,
    });

    return result;
  }

  /**
   * Step 3: Check login status (polling fallback)
   *
   * GET /auth/telegram/status/:loginId
   * Response: { status: 'PENDING' | 'CONFIRMED' | 'EXPIRED', accessToken?, user? }
   */
  @Get('telegram/status/:loginId')
  async checkLoginStatus(@Param('loginId') loginId: string) {
    return this.authService.checkLoginStatus(loginId);
  }

  // ==========================================
  // TELEGRAM WEBAPP ENDPOINT (Yangi)
  // ==========================================

  /**
   * Telegram Web App (Mini App) orqali autentifikatsiya
   * Frontend Telegram.WebApp.initData ni yuboradi
   * Backend initData ni validate qiladi va JWT qaytaradi
   *
   * POST /auth/telegram/webapp
   * Body: { initData: string }
   * Response: { success: boolean, accessToken: string, user: {...} }
   *
   * Xatolar:
   * - 401: Invalid/expired initData
   * - 400: Missing required fields
   */
  @Throttle({ default: { limit: 30, ttl: 60 } })
  @Post('telegram/webapp')
  async authenticateWebApp(@Body() dto: TelegramWebAppAuthDto) {
    return this.authService.validateWebAppInitData(dto.initData);
  }

  // ==========================================
  // PROTECTED ENDPOINTS
  // ==========================================

  /**
   * Get current user info (protected route)
   * Works with JWT from both website and WebApp auth
   *
   * GET /auth/me
   * Headers: Authorization: Bearer <token>
   * Response: User object
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return req.user;
  }

  // ==========================================
  // DISABLED LEGACY ENDPOINTS
  // ==========================================

  /**
   * @deprecated Email/password registration is disabled
   */
  @Post('register')
  register() {
    return this.authService.register();
  }

  /**
   * @deprecated Email/password login is disabled
   */
  @Post('login')
  login() {
    return this.authService.login();
  }
}
