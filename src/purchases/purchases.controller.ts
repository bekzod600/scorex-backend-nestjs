import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('signals')
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post(':id/buy')
  buy(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.purchasesService.buySignal(req.user.id, id);
  }
}
