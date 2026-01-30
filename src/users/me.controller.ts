// src/users/me.controller.ts
import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { SignalsService } from '../signals/signals.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly signalsService: SignalsService) {}

  @Get('signals')
  async getMySignals(
    @Req() req: AuthenticatedRequest,
    @Query('tab') tab?: 'live' | 'results',
  ) {
    return this.signalsService.getMySignals(req.user.id, { tab });
  }
}
