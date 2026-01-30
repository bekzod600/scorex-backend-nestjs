// src/traders/traders.controller.ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { TradersService } from './traders.service';

@Controller('traders')
export class TradersController {
  constructor(private readonly tradersService: TradersService) {}

  /**
   * GET /traders
   * Returns leaderboard of traders
   */
  @Get()
  async list(
    @Query('sortBy') sortBy?: 'scorex' | 'profit' | 'stars',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.tradersService.list({
      sortBy,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });

    return {
      traders: result.traders,
      total: result.total,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    };
  }

  /**
   * GET /traders/:username
   * Returns trader profile by username
   */
  @Get(':username')
  async findByUsername(@Param('username') username: string) {
    return this.tradersService.findByUsername(username);
  }

  /**
   * GET /traders/:username/signals
   * Returns signals by trader
   */
  @Get(':username/signals')
  async getSignals(
    @Param('username') username: string,
    @Query('tab') tab?: 'live' | 'results',
  ) {
    const signals = await this.tradersService.getSignalsByUsername(username, {
      tab,
    });

    return {
      signals,
      total: signals.length,
    };
  }
}
