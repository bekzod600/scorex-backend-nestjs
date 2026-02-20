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
  RegisterCenterDto,
  UpdateCenterDto,
  RateCenterDto,
  RejectCenterDto,
  ReviewEnrollmentDto,
} from './dto/training-centers.dto';
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

// ============================================================
// PUBLIC + AUTH ROUTES: /training-centers
// ============================================================
@Controller('training-centers')
export class TrainingCentersController {
  constructor(private readonly service: TrainingCentersService) {}

  /** GET /training-centers — approved markazlar ro'yxati */
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

  /** GET /training-centers/my — owner o'z markazini ko'radi */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  getMy(@Req() req: AuthenticatedRequest) {
    return this.service.getMy(req.user.id);
  }

  /**
   * GET /training-centers/my/enrollment-requests
   * Owner pending/approved/rejected so'rovlar ro'yxatini ko'radi
   */
  @UseGuards(JwtAuthGuard)
  @Get('my/enrollment-requests')
  getMyRequests(@Req() req: AuthenticatedRequest) {
    return this.service.getMyEnrollmentRequests(req.user.id);
  }

  /**
   * PATCH /training-centers/my/enrollment-requests/:requestId/approve
   * Owner so'rovni tasdiqlaydi → user "approved student" bo'ladi
   */
  @UseGuards(JwtAuthGuard)
  @Patch('my/enrollment-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  approveRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ) {
    return this.service.approveEnrollment(requestId, req.user.id);
  }

  /**
   * PATCH /training-centers/my/enrollment-requests/:requestId/reject
   * Owner so'rovni rad etadi
   */
  @UseGuards(JwtAuthGuard)
  @Patch('my/enrollment-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  rejectRequest(
    @Req() req: AuthenticatedRequest,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewEnrollmentDto,
  ) {
    return this.service.rejectEnrollment(requestId, req.user.id, dto.note);
  }

  /** GET /training-centers/:id — bitta markaz detallari */
  @UseGuards(OptionalJwtAuthGuard)
  @Get(':id')
  getOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getApproved(id, req.user?.id);
  }

  /** POST /training-centers — yangi markaz ro'yxatdan o'tkazish */
  @UseGuards(JwtAuthGuard)
  @Post()
  register(@Req() req: AuthenticatedRequest, @Body() dto: RegisterCenterDto) {
    return this.service.register(req.user.id, dto);
  }

  /** PATCH /training-centers/my — markaz ma'lumotlarini yangilash */
  @UseGuards(JwtAuthGuard)
  @Patch('my')
  updateMy(@Req() req: AuthenticatedRequest, @Body() dto: UpdateCenterDto) {
    return this.service.updateMy(req.user.id, dto);
  }

  /**
   * POST /training-centers/:id/enroll
   * "Studied here" — so'rov yuborish (TO'G'RIDAN ENROLLMENT EMAS!)
   * Owner o'z markaziga so'rov yubora olmaydi (403)
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/enroll')
  @HttpCode(HttpStatus.OK)
  enroll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.requestEnroll(id, req.user.id);
  }

  /**
   * DELETE /training-centers/:id/enroll
   * So'rovni bekor qilish yoki studentlikdan chiqish
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/enroll')
  @HttpCode(HttpStatus.OK)
  unenroll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancelEnroll(id, req.user.id);
  }

  /** POST /training-centers/:id/rate — 1-5 yulduz reyting */
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

  @Get(':id')
  getById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.getById(id);
  }

  @Patch(':id/approve')
  approve(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.adminApprove(id, req.user.id);
  }

  @Patch(':id/reject')
  reject(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectCenterDto,
  ) {
    this.requireAdmin(req);
    return this.service.adminReject(id, req.user.id, dto.reason);
  }

  @Patch(':id/toggle-listing')
  toggleListing(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.service.adminToggleListing(id);
  }
}
