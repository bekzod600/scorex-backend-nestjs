import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // USERS
  @Get('users')
  users() {
    return this.admin.listUsers();
  }

  // TRAINING CENTERS
  @Get('training-centers')
  centers() {
    return this.admin.listTrainingCenters();
  }

  @Post('training-centers/:id/approve')
  approveCenter(@Param('id') id: string) {
    return this.admin.approveTrainingCenter(id);
  }

  @Post('training-centers/:id/reject')
  rejectCenter(@Param('id') id: string) {
    return this.admin.rejectTrainingCenter(id);
  }

  // P2P TOPUPS
  @Get('p2p-topups')
  p2pTopups() {
    return this.admin.listP2pTopups();
  }

  @Post('p2p-topups/:id/approve')
  approveP2p(@Param('id') id: string) {
    return this.admin.approveP2pTopup(id);
  }

  @Post('p2p-topups/:id/reject')
  rejectP2p(@Param('id') id: string, @Body('note') note?: string) {
    return this.admin.rejectP2pTopup(id, note);
  }

  // SIGNALS
  @Post('signals/:id/force-cancel')
  forceCancel(@Param('id') id: string) {
    return this.admin.forceCancelSignal(id);
  }
}
