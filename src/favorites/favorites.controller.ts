// src/favorites/favorites.controller.ts
import {
  Controller,
  Delete,
  Param,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@Controller()
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  /**
   * POST /signals/:id/favorite
   * Add signal to favorites
   */
  @UseGuards(JwtAuthGuard)
  @Post('signals/:id/favorite')
  @HttpCode(HttpStatus.OK)
  async addFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('id') signalId: string,
  ) {
    await this.favoritesService.addFavorite(req.user.id, signalId);
    return { success: true, message: 'Signal added to favorites' };
  }

  /**
   * DELETE /signals/:id/favorite
   * Remove signal from favorites
   */
  @UseGuards(JwtAuthGuard)
  @Delete('signals/:id/favorite')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @Req() req: AuthenticatedRequest,
    @Param('id') signalId: string,
  ) {
    await this.favoritesService.removeFavorite(req.user.id, signalId);
    return { success: true, message: 'Signal removed from favorites' };
  }
}

