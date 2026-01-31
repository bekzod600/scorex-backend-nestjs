// src/signals/signals.controller.ts
// YANGILANGAN VERSIYA - GET /:id va /me/signals qo'shilgan

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SignalsService } from './signals.service';
import { CreateSignalDto } from './dto/create-signal.dto';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';
import { SignalEngineService } from './engine/signal-engine.service';

@Controller('signals')
export class SignalsController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly engine: SignalEngineService,
  ) {}

  /**
   * GET /signals
   * List all signals with optional tab filter
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list(
    @Req() req: AuthenticatedRequest,
    @Query('tab') tab?: 'live' | 'results',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.signalsService.list(req?.user?.id, {
      tab,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  /**
   * GET /signals/:id
   * Get single signal by ID
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.signalsService.findByIdWithAccess(id, req?.user?.id);
  }

  /**
   * POST /signals
   * Create new signal (requires auth)
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSignalDto) {
    return this.signalsService.create(req.user.id, dto);
  }

  // ENGINE ENDPOINTS (internal / admin / cron)
  @Post(':id/entered')
  markEntered(@Param('id', ParseUUIDPipe) id: string) {
    return this.engine.markEntered(id);
  }

  @Post(':id/tp')
  markTp(@Param('id', ParseUUIDPipe) id: string) {
    return this.engine.markTp(id);
  }

  @Post(':id/sl')
  markSl(@Param('id', ParseUUIDPipe) id: string) {
    return this.engine.markSl(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.engine.cancel(id);
  }
}
