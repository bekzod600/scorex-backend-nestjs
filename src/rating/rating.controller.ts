// src/rating/rating.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RatingService } from './rating.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';
import { RateTraderDto } from './dto/rate-trader.dto';
import { VoteSignalDto } from './dto/vote-signal.dto';

@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  /**
   * POST /traders/:username/rate
   * Rate a trader (1-5 stars)
   */
  @UseGuards(JwtAuthGuard)
  @Post('traders/:username/rate')
  async rateTrader(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
    @Body() dto: RateTraderDto,
  ) {
    await this.ratingService.rateTrader(req.user.id, username, dto.stars);
    return { success: true, message: 'Trader rated successfully' };
  }

  /**
   * GET /traders/:username/my-rating
   * Get user's rating for trader
   */
  @UseGuards(JwtAuthGuard)
  @Get('traders/:username/my-rating')
  async getMyTraderRating(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ) {
    return this.ratingService.getMyTraderRating(req.user.id, username);
  }

  /**
   * POST /signals/:id/vote
   * Vote on signal (like/dislike)
   */
  @UseGuards(JwtAuthGuard)
  @Post('signals/:id/vote')
  async voteSignal(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) signalId: string,
    @Body() dto: VoteSignalDto,
  ) {
    const counts = await this.ratingService.voteSignal(req.user.id, signalId, dto.vote);
    return { 
      success: true, 
      likes: counts.likes,
      dislikes: counts.dislikes 
    };
  }

  /**
   * GET /signals/:id/my-vote
   * Get user's vote for signal
   */
  @UseGuards(JwtAuthGuard)
  @Get('signals/:id/my-vote')
  async getMySignalVote(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) signalId: string,
  ) {
    return this.ratingService.getMySignalVote(req.user.id, signalId);
  }
}

