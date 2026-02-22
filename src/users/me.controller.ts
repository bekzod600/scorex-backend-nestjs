// src/users/me.controller.ts
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Pool } from 'pg';
import { SignalsService } from '../signals/signals.service';
import { FavoritesService } from '../favorites/favorites.service';
import { TradersService } from '../traders/traders.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatar?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly favoritesService: FavoritesService,
    private readonly tradersService: TradersService,
    @Inject('PG_POOL') private readonly pool: Pool,
  ) {}

  // ─────────────────────────────────────────────────────
  // GET /me/profile  ← BU YO'Q EDI, MUAMMOning SABABI
  // ─────────────────────────────────────────────────────
  @Get('profile')
  async getMyProfile(@Req() req: AuthenticatedRequest) {
    const { rows } = await this.pool.query(
      `SELECT
         id,
         telegram_id,
         telegram_username,
         telegram_first_name,
         telegram_last_name,
         display_name,
         bio,
         avatar,
         role,
         score_x,
         created_at,
         updated_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id],
    );

    if (!rows[0]) {
      return { id: req.user.id, role: req.user.role };
    }

    const row = rows[0];
    return {
      id: row.id,
      telegramId: row.telegram_id,
      telegramUsername: row.telegram_username,
      telegramFirstName: row.telegram_first_name,
      telegramLastName: row.telegram_last_name,
      displayName: row.display_name || row.telegram_first_name || null,
      bio: row.bio || null,
      avatar: row.avatar || null,
      role: row.role,
      scoreXPoints: Number(row.score_x) || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ─────────────────────────────────────────────────────
  // PATCH /me/profile
  // ─────────────────────────────────────────────────────
  @Patch('profile')
  async updateMyProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.displayName !== undefined) {
      fields.push(`display_name = $${idx++}`);
      values.push(dto.displayName.trim().slice(0, 100) || null);
    }
    if (dto.bio !== undefined) {
      fields.push(`bio = $${idx++}`);
      values.push(dto.bio.trim().slice(0, 300) || null);
    }
    if (dto.avatar !== undefined) {
      fields.push(`avatar = $${idx++}`);
      values.push(dto.avatar || null);
    }

    if (fields.length === 0) {
      return { success: true, message: 'Nothing to update' };
    }

    fields.push(`updated_at = NOW()`);
    values.push(req.user.id);

    const { rows } = await this.pool.query(
      `UPDATE users
       SET ${fields.join(', ')}
       WHERE id = $${idx}
       RETURNING
         id,
         telegram_username,
         telegram_first_name,
         display_name,
         bio,
         avatar`,
      values,
    );

    const row = rows[0];
    return {
      success: true,
      profile: {
        id: row.id,
        telegramUsername: row.telegram_username,
        telegramFirstName: row.telegram_first_name,
        displayName: row.display_name,
        bio: row.bio,
        avatar: row.avatar,
      },
    };
  }

  // ─────────────────────────────────────────────────────
  // GET /me/stats
  // ─────────────────────────────────────────────────────
  @Get('stats')
  async getMyStats(@Req() req: AuthenticatedRequest) {
    return this.tradersService.findByUserId(req.user.id);
  }

  // ─────────────────────────────────────────────────────
  // GET /me/signals
  // ─────────────────────────────────────────────────────
  @Get('signals')
  async getMySignals(
    @Req() req: AuthenticatedRequest,
    @Query('tab') tab?: 'live' | 'results',
  ) {
    return this.signalsService.getMySignals(req.user.id, { tab });
  }

  // ─────────────────────────────────────────────────────
  // POST /me/signals/:id/cancel
  // ─────────────────────────────────────────────────────
  @Post('signals/:id/cancel')
  async cancelMySignal(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.signalsService.cancelOwnSignal(req.user.id, id);
  }

  // ─────────────────────────────────────────────────────
  // GET /me/favorites
  // ─────────────────────────────────────────────────────
  @Get('favorites')
  async getFavorites(@Req() req: AuthenticatedRequest) {
    return this.favoritesService.getFavorites(req.user.id);
  }
}
