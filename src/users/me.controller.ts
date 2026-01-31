// src/users/me.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SignalsService } from '../signals/signals.service';
import { FavoritesService } from '../favorites/favorites.service';
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
  ) {}

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
   * GET /me/favorites
   * Get current user's favorite signals
   */
  @Get('favorites')
  async getFavorites(@Req() req: AuthenticatedRequest) {
    return this.favoritesService.getFavorites(req.user.id);
  }
}
