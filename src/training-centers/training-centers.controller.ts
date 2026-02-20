// src/training-centers/training-centers.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  ParseUUIDPipe,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TrainingCentersService } from './training-centers.service';
import {
  UpdateCenterDto,
  RateCenterDto,
  RejectCenterDto,
} from './dto/training-centers.dto';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

// ============================================================
// PUBLIC ROUTES: /training-centers
// ============================================================
@Controller('training-centers')
export class TrainingCentersController {
  constructor(private readonly service: TrainingCentersService) {}

  /**
   * GET /training-centers
   * Tasdiqlangan va listed markazlar ro'yxati
   * Auth ixtiyoriy — login qilgan bo'lsa enrollment/rating kontekst keladi
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('city') city?: string,
    @Query('sort') sort?: 'rating' | 'students' | 'newest',
  ) {
    return this.service.listApproved({
      page,
      limit,
      search,
      city,
      sort,
      userId: req.user?.id,
    });
  }

  /**
   * GET /training-centers/my
   * Owner o'z markazini ko'rish
   * Requires auth
   */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMy(@Req() req: AuthenticatedRequest) {
    return this.service.getMy(req.user.id);
  }

  /**
   * GET /training-centers/:id
   * Bitta markaz detallari (faqat approved+listed)
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getApproved(id, req.user?.id);
  }

  /**
   * POST /training-centers
   * Yangi markaz ro'yxatdan o'tkazish (har user faqat 1 ta)
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  register(@Req() req: AuthenticatedRequest) {
    return this.service.register(req.user.id);
  }

  /**
   * PATCH /training-centers/my
   * Owner o'z markazini yangilashi (faqat ruxsat berilgan maydonlar)
   */
  @UseGuards(JwtAuthGuard)
  @Patch('my')
  updateMy(@Req() req: AuthenticatedRequest, @Body() dto: UpdateCenterDto) {
    return this.service.updateMy(req.user.id, dto);
  }

  /**
   * POST /training-centers/:id/enroll
   * "Men shu yerda o'qidim" belgisi qo'yish
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/enroll')
  @HttpCode(HttpStatus.OK)
  enroll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.enroll(id, req.user.id);
  }

  /**
   * DELETE /training-centers/:id/enroll
   * Belgi olib tashlash
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/enroll')
  @HttpCode(HttpStatus.OK)
  unenroll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.unenroll(id, req.user.id);
  }

  /**
   * POST /training-centers/:id/rate
   * 1-5 yulduz reyting berish
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  rate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateCenterDto,
  ) {
    return this.service.rate(id, req.user.id, dto.rating);
  }
}

// ============================================================
// ADMIN ROUTES: /admin/training-centers
// ============================================================
@UseGuards(JwtAuthGuard)
@Controller('admin/training-centers')
export class AdminTrainingCentersController {
  constructor(private readonly service: TrainingCentersService) {}

  private requireAdmin(req: AuthenticatedRequest): void {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * GET /admin/training-centers
   * Barcha markazlar (status filter bilan)
   */
  @Get()
  listAll(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    this.requireAdmin(req);
    return this.service.adminList({ page, limit, status, search });
  }

  /**
   * GET /admin/training-centers/:id
   * Bitta markazni ko'rish (har qanday status)
   */
  @Get(':id')
  getById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.getById(id);
  }

  /**
   * PATCH /admin/training-centers/:id/approve
   * Markazni tasdiqlash
   */
  @Patch(':id/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.adminApprove(id, req.user.id);
  }

  /**
   * PATCH /admin/training-centers/:id/reject
   * Markazni rad etish (sabab bilan)
   */
  @Patch(':id/reject')
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCenterDto,
  ) {
    this.requireAdmin(req);
    return this.service.adminReject(id, req.user.id, dto.reason);
  }

  /**
   * PATCH /admin/training-centers/:id/toggle-listing
   * Ko'rinishini yoqish/o'chirish
   */
  @Patch(':id/toggle-listing')
  toggleListing(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.adminToggleListing(id);
  }
}
