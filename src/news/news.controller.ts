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
} from '@nestjs/common';
import { NewsService } from './news.service';
import { CreateNewsPostDto, UpdateNewsPostDto } from './dto/news.dto';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/jwt-auth.guard';

// ============================================================
// PUBLIC ROUTES: /news
// ============================================================
@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * GET /news
   * List all published news posts (paginated)
   * No auth required
   */
  @Get()
  listPublished(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const safeLimit = Math.min(limit, 100);
    return this.newsService.listPublished(page, safeLimit);
  }

  /**
   * GET /news/:id
   * Get single published news post
   * No auth required
   */
  @Get(':id')
  getPublished(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.getPublished(id);
  }
}

// ============================================================
// ADMIN ROUTES: /admin/news
// All routes require JWT + admin/super_admin role
// ============================================================
@UseGuards(JwtAuthGuard)
@Controller('admin/news')
export class AdminNewsController {
  constructor(private readonly newsService: NewsService) {}

  /**
   * Guard helper: ensure requester is admin or super_admin
   */
  private requireAdmin(req: AuthenticatedRequest): void {
    const role = req.user.role;
    if (role !== 'admin' && role !== 'super_admin') {
      throw new ForbiddenException('Admin access required');
    }
  }

  /**
   * GET /admin/news
   * List ALL posts including drafts (admin only)
   */
  @Get()
  listAll(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    this.requireAdmin(req);
    const safeLimit = Math.min(limit, 100);
    return this.newsService.listAll(page, safeLimit);
  }

  /**
   * GET /admin/news/:id
   * Get any post by id including drafts
   */
  @Get(':id')
  getById(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.newsService.getById(id);
  }

  /**
   * POST /admin/news
   * Create a new news post (draft by default)
   */
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateNewsPostDto) {
    this.requireAdmin(req);
    return this.newsService.create(req.user.id, dto);
  }

  /**
   * PATCH /admin/news/:id
   * Update an existing news post (partial)
   */
  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNewsPostDto,
  ) {
    this.requireAdmin(req);
    return this.newsService.update(id, req.user.id, req.user.role, dto);
  }

  /**
   * PATCH /admin/news/:id/toggle-publish
   * Toggle publish/unpublish status
   */
  @Patch(':id/toggle-publish')
  togglePublish(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.newsService.togglePublish(id);
  }

  /**
   * DELETE /admin/news/:id
   * Permanently delete a news post
   */
  @Delete(':id')
  delete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    this.requireAdmin(req);
    return this.newsService.delete(id);
  }
}
