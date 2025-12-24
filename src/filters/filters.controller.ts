import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { FiltersService } from './filters.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';
import { CreateFilterDto } from './dto/create-filter.dto';

@UseGuards(JwtAuthGuard)
@Controller('filters')
export class FiltersController {
  constructor(private readonly filtersService: FiltersService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFilterDto) {
    return this.filtersService.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.filtersService.list(req.user.id);
  }
}
