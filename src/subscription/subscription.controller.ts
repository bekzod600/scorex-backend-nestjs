// src/subscription/subscription.controller.ts
// Premium subscription API endpoints

import {
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * GET /subscription
   * Get current user's subscription status
   */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getStatus(@Req() req: AuthenticatedRequest) {
    const status = await this.subscriptionService.getSubscriptionStatus(
      req.user.id,
    );
    return status;
  }

  /**
   * POST /subscription/purchase
   * Purchase premium subscription
   */
  @UseGuards(JwtAuthGuard)
  @Post('purchase')
  @HttpCode(HttpStatus.OK)
  async purchase(@Req() req: AuthenticatedRequest) {
    const result = await this.subscriptionService.purchasePremium(req.user.id);
    return result;
  }

  /**
   * PATCH /subscription/auto-renew
   * Toggle auto-renew setting
   */
  @UseGuards(JwtAuthGuard)
  @Patch('auto-renew')
  @HttpCode(HttpStatus.OK)
  async setAutoRenew(
    @Req() req: AuthenticatedRequest,
    @Body() body: { enabled: boolean },
  ) {
    await this.subscriptionService.setAutoRenew(req.user.id, body.enabled);
    return { success: true, autoRenew: body.enabled };
  }

  /**
   * POST /subscription/cancel
   * Cancel subscription (disable auto-renew)
   */
  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Req() req: AuthenticatedRequest) {
    await this.subscriptionService.cancelSubscription(req.user.id);
    return {
      success: true,
      message: 'Auto-renew disabled. Subscription active until expiry.',
    };
  }
}
