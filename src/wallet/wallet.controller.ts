import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { WalletService } from './wallet.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Req() req: AuthenticatedRequest) {
    return this.walletService.getWallet(req.user.id);
  }

  @Get('transactions')
  async getTransactions(@Req() req: AuthenticatedRequest) {
    return this.walletService.getTransactions(req.user.id);
  }
}
