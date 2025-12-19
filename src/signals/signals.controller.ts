import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SignalsService } from './signals.service';
import { CreateSignalDto } from './dto/create-signal.dto';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';
import { SignalEngineService } from './engine/signal-engine.service';

@Controller('signals')
export class SignalsController {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly engine: SignalEngineService,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.signalsService.list(req?.user?.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateSignalDto) {
    return this.signalsService.create(req.user.id, dto);
  }

  // ENGINE ENDPOINTS (internal / admin / cron)
  @Post(':id/entered')
  markEntered(@Param('id') id: string) {
    return this.engine.markEntered(id);
  }

  @Post(':id/tp')
  markTp(@Param('id') id: string) {
    return this.engine.markTp(id);
  }

  @Post(':id/sl')
  markSl(@Param('id') id: string) {
    return this.engine.markSl(id);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string) {
    return this.engine.cancel(id);
  }
}
