// src/users/me.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SignalsService } from '../signals/signals.service';
import { FavoritesService } from '../favorites/favorites.service';
import { TradersService } from '../traders/traders.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly favoritesService: FavoritesService,
    private readonly tradersService: TradersService,
  ) {}

  /**
   * GET /me/stats
   * Get current user's full stats (works for new users with 0 signals)
   */
  @Get('stats')
  async getMyStats(@Req() req: AuthenticatedRequest) {
    return this.tradersService.findByUserId(req.user.id);
  }

  /**
   * GET /me/signals
   * Get current user's signals
   */
  @Get('signals')
  async getMySignals(
    @Req() req: AuthenticatedRequest,
    @Query('tab') tab?: 'live' | 'results',
  ) {
    return this.signalsService.getMySignals(req.user.id, { tab });
  }

  /**
   * POST /me/signals/:id/cancel
   * Cancel own signal (only owner can cancel)
   */
  @Post('signals/:id/cancel')
  cancelMySignal(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signalsService.cancelOwnSignal(req.user.id, id);
  }

  /**
   * GET /me/favorites
   * Get current user's favorite signals
   */
  @Get('favorites')
  async getFavorites(@Req() req: AuthenticatedRequest) {
    return this.favoritesService.getFavorites(req.user.id);
  }
}
