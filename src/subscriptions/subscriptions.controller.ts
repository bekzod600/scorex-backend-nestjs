// src/subscriptions/subscriptions.controller.ts
import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@Controller()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * POST /traders/:username/subscribe
   * Subscribe to a trader
   */
  @UseGuards(JwtAuthGuard)
  @Post('traders/:username/subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ) {
    await this.subscriptionsService.subscribe(req.user.id, username);
    return { success: true, message: 'Subscribed successfully' };
  }

  /**
   * DELETE /traders/:username/subscribe
   * Unsubscribe from a trader
   */
  @UseGuards(JwtAuthGuard)
  @Delete('traders/:username/subscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Req() req: AuthenticatedRequest,
    @Param('username') username: string,
  ) {
    await this.subscriptionsService.unsubscribe(req.user.id, username);
    return { success: true, message: 'Unsubscribed successfully' };
  }

  /**
   * GET /me/subscriptions
   * Get current user's subscriptions
   */
  @UseGuards(JwtAuthGuard)
  @Get('me/subscriptions')
  async getSubscriptions(@Req() req: AuthenticatedRequest) {
    const subscriptions =
      await this.subscriptionsService.getSubscriptions(req.user.id);
    return {
      subscriptions,
      total: subscriptions.length,
    };
  }
}

