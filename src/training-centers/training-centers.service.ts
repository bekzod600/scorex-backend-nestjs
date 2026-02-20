// src/training-centers/training-centers.service.ts
import {
  Injectable,
  NotFoundException,
  // ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import type {
  UpdateCenterDto,
  TrainingCenterResponse,
  CentersListResponse,
} from './dto/training-centers.dto';

@Injectable()
export class TrainingCentersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // ============================================================
  // PUBLIC: Tasdiqlangan markazlar ro'yxati
  // GET /training-centers
  // ============================================================
  async listApproved(params: {
    page?: number;
    limit?: number;
    search?: string;
    city?: string;
    sort?: 'rating' | 'students' | 'newest';
    userId?: string;
  }): Promise<CentersListResponse> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      `tc.status = 'approved'`,
      `tc.is_listed = TRUE`,
    ];
    const values: unknown[] = [];
    let idx = 1;

    if (params.search) {
      conditions.push(
        `(tc.name ILIKE $${idx} OR tc.city ILIKE $${idx} OR tc.description ILIKE $${idx})`,
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    if (params.city && params.city !== 'all') {
      conditions.push(`tc.city = $${idx}`);
      values.push(params.city);
      idx++;
    }

    const where = conditions.join(' AND ');

    const sortMap: Record<string, string> = {
      rating: 'tc.rating DESC, tc.rating_count DESC',
      students: 'tc.students_count DESC',
      newest: 'tc.created_at DESC',
    };
    const orderBy = sortMap[params.sort ?? 'rating'];

    // Enrollment va rating konteksti (agar login qilgan bo'lsa)
    const enrolledSubquery = params.userId
      ? `(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${params.userId}') IS NOT NULL`
      : 'FALSE';

    const userRatingSubquery = params.userId
      ? `(SELECT cr.rating FROM center_ratings cr WHERE cr.center_id = tc.id AND cr.user_id = '${params.userId}' LIMIT 1)`
      : 'NULL';

    const [listResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT
           tc.id,
           tc.name,
           tc.description,
           tc.city,
           tc.address,
           tc.phone,
           tc.telegram,
           tc.website,
           tc.logo_url,
           tc.status,
           tc.is_listed,
           tc.rating,
           tc.rating_count,
           tc.students_count,
           tc.rejection_reason,
           tc.approved_at,
           tc.created_at,
           -- Owner info
           u.id               AS owner_id,
           u.telegram_username AS owner_username,
           u.telegram_first_name AS owner_first_name,
           -- User context
           ${enrolledSubquery}  AS is_enrolled,
           ${userRatingSubquery} AS user_rating
         FROM training_centers tc
         LEFT JOIN users u ON u.id = tc.owner_id
         WHERE ${where}
         ORDER BY ${orderBy}
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM training_centers tc WHERE ${where}`,
        values,
      ),
    ]);

    return {
      centers: listResult.rows.map((row) => this.formatCenter(row)),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  // ============================================================
  // PUBLIC: Bitta markaz detallari
  // GET /training-centers/:id
  // ============================================================
  async getApproved(
    id: string,
    userId?: string,
  ): Promise<TrainingCenterResponse> {
    const center = await this.getById(id, userId);
    if (center.status !== 'approved' || !center.is_listed) {
      throw new NotFoundException('Training center not found');
    }

    // Students (oxirgi 50 ta)
    const studentsResult = await this.pool.query(
      `SELECT
         ce.user_id,
         u.telegram_username AS username,
         u.telegram_first_name AS first_name,
         ce.created_at AS enrolled_at
       FROM center_enrollments ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.center_id = $1
       ORDER BY ce.created_at DESC
       LIMIT 50`,
      [id],
    );

    return {
      ...center,
      students: studentsResult.rows.map((s) => ({
        user_id: s.user_id,
        username: s.username ?? s.first_name ?? 'User',
        avatar: null,
        enrolled_at:
          s.enrolled_at instanceof Date
            ? s.enrolled_at.toISOString()
            : String(s.enrolled_at),
      })),
    };
  }

  // ============================================================
  // AUTH: Owner o'z markazini olish
  // GET /training-centers/my
  // ============================================================
  async getMy(userId: string): Promise<TrainingCenterResponse | null> {
    const result = await this.pool.query(
      `SELECT
         tc.*,
         u.id               AS owner_id,
         u.telegram_username AS owner_username,
         u.telegram_first_name AS owner_first_name
       FROM training_centers tc
       LEFT JOIN users u ON u.id = tc.owner_id
       WHERE tc.owner_id = $1`,
      [userId],
    );

    if (!result.rows.length) return null;
    return this.formatCenter(result.rows[0]);
  }

  // ============================================================
  // AUTH: Yangi markaz ro'yxatdan o'tkazish
  // POST /training-centers
  // ============================================================
  async register(userId: string): Promise<TrainingCenterResponse> {
    // Har bir user faqat bitta markaz ochishi mumkin
    const existing = await this.pool.query(
      `SELECT id FROM training_centers WHERE owner_id = $1`,
      [userId],
    );
    if (existing.rows.length) {
      throw new ConflictException(
        'You already have a registered training center',
      );
    }

    return this.getMy(userId) as Promise<TrainingCenterResponse>;
  }

  // ============================================================
  // AUTH: Owner o'z markazini yangilashi
  // PATCH /training-centers/my
  // ============================================================
  async updateMy(
    userId: string,
    dto: UpdateCenterDto,
  ): Promise<TrainingCenterResponse> {
    const existing = await this.pool.query(
      `SELECT id FROM training_centers WHERE owner_id = $1`,
      [userId],
    );
    if (!existing.rows.length) {
      throw new NotFoundException('You do not have a registered center');
    }

    const centerId = existing.rows[0].id;

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.address !== undefined) {
      fields.push(`address = $${idx++}`);
      values.push(dto.address);
    }
    if (dto.phone !== undefined) {
      fields.push(`phone = $${idx++}`);
      values.push(dto.phone);
    }
    if (dto.telegram !== undefined) {
      fields.push(`telegram = $${idx++}`);
      values.push(dto.telegram);
    }
    if (dto.website !== undefined) {
      fields.push(`website = $${idx++}`);
      values.push(dto.website);
    }
    if (dto.logo_url !== undefined) {
      fields.push(`logo_url = $${idx++}`);
      values.push(dto.logo_url);
    }

    if (fields.length) {
      values.push(centerId);
      await this.pool.query(
        `UPDATE training_centers SET ${fields.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }

    return this.getMy(userId) as Promise<TrainingCenterResponse>;
  }

  // ============================================================
  // AUTH: "Men shu yerda o'qidim" belgisi qo'yish/olib tashlash
  // POST /training-centers/:id/enroll
  // DELETE /training-centers/:id/enroll
  // ============================================================
  async enroll(
    centerId: string,
    userId: string,
  ): Promise<{ enrolled: boolean; students_count: number }> {
    // Markaz mavjudligini tekshir
    const centerRes = await this.pool.query(
      `SELECT id, students_count FROM training_centers WHERE id = $1 AND status = 'approved'`,
      [centerId],
    );
    if (!centerRes.rows.length) {
      throw new NotFoundException('Training center not found');
    }

    // Allaqachon ro'yxatdan o'tganmi?
    const existing = await this.pool.query(
      `SELECT id FROM center_enrollments WHERE center_id = $1 AND user_id = $2`,
      [centerId, userId],
    );
    if (existing.rows.length) {
      throw new ConflictException('Already enrolled in this center');
    }

    await this.pool.query(
      `INSERT INTO center_enrollments (center_id, user_id) VALUES ($1, $2)`,
      [centerId, userId],
    );

    const updated = await this.pool.query(
      `SELECT students_count FROM training_centers WHERE id = $1`,
      [centerId],
    );

    return {
      enrolled: true,
      students_count: updated.rows[0]?.students_count ?? 0,
    };
  }

  async unenroll(
    centerId: string,
    userId: string,
  ): Promise<{ enrolled: boolean; students_count: number }> {
    await this.pool.query(
      `DELETE FROM center_enrollments WHERE center_id = $1 AND user_id = $2`,
      [centerId, userId],
    );

    const updated = await this.pool.query(
      `SELECT students_count FROM training_centers WHERE id = $1`,
      [centerId],
    );

    return {
      enrolled: false,
      students_count: updated.rows[0]?.students_count ?? 0,
    };
  }

  // ============================================================
  // AUTH: Reyting berish (1-5 yulduz)
  // POST /training-centers/:id/rate
  // ============================================================
  async rate(
    centerId: string,
    userId: string,
    rating: number,
  ): Promise<{ rating: number; rating_count: number; user_rating: number }> {
    const centerRes = await this.pool.query(
      `SELECT id FROM training_centers WHERE id = $1 AND status = 'approved'`,
      [centerId],
    );
    if (!centerRes.rows.length) {
      throw new NotFoundException('Training center not found');
    }

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Upsert (INSERT yoki UPDATE)
    await this.pool.query(
      `INSERT INTO center_ratings (center_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (center_id, user_id)
       DO UPDATE SET rating = $3, updated_at = NOW()`,
      [centerId, userId, rating],
    );

    // Trigger avtomatik avg hisoblaydi, faqat yangi qiymatni qaytaramiz
    const updated = await this.pool.query(
      `SELECT rating, rating_count FROM training_centers WHERE id = $1`,
      [centerId],
    );

    return {
      rating: parseFloat(updated.rows[0]?.rating ?? '0'),
      rating_count: updated.rows[0]?.rating_count ?? 0,
      user_rating: rating,
    };
  }

  // ============================================================
  // ADMIN: Barcha markazlar ro'yxati (filter bilan)
  // GET /admin/training-centers
  // ============================================================
  async adminList(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<CentersListResponse> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (params.status && params.status !== 'all') {
      conditions.push(`tc.status = $${idx}`);
      values.push(params.status);
      idx++;
    }

    if (params.search) {
      conditions.push(
        `(tc.name ILIKE $${idx} OR tc.city ILIKE $${idx} OR u.telegram_username ILIKE $${idx})`,
      );
      values.push(`%${params.search}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [listResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT
           tc.*,
           u.id               AS owner_id,
           u.telegram_username AS owner_username,
           u.telegram_first_name AS owner_first_name
         FROM training_centers tc
         LEFT JOIN users u ON u.id = tc.owner_id
         ${where}
         ORDER BY
           CASE tc.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
           tc.created_at DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM training_centers tc LEFT JOIN users u ON u.id = tc.owner_id ${where}`,
        values,
      ),
    ]);

    return {
      centers: listResult.rows.map((row) => this.formatCenter(row)),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  // ============================================================
  // ADMIN: Tasdiqlash
  // ============================================================
  async adminApprove(
    centerId: string,
    adminId: string,
  ): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers
       SET status = 'approved', is_listed = TRUE,
           approved_at = NOW(), reviewed_by = $2,
           rejection_reason = NULL
       WHERE id = $1
       RETURNING *`,
      [centerId, adminId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Training center not found');
    }

    return this.getById(centerId);
  }

  // ============================================================
  // ADMIN: Rad etish
  // ============================================================
  async adminReject(
    centerId: string,
    adminId: string,
    reason?: string,
  ): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers
       SET status = 'rejected', is_listed = FALSE,
           reviewed_by = $2,
           rejection_reason = $3
       WHERE id = $1
       RETURNING *`,
      [centerId, adminId, reason ?? null],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Training center not found');
    }

    return this.getById(centerId);
  }

  // ============================================================
  // ADMIN: Ko'rinishini yoqish/o'chirish (toggle listing)
  // ============================================================
  async adminToggleListing(centerId: string): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers
       SET is_listed = NOT is_listed
       WHERE id = $1 AND status = 'approved'
       RETURNING *`,
      [centerId],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Approved training center not found');
    }

    return this.getById(centerId);
  }

  // ============================================================
  // PRIVATE: ID bo'yicha bitta markaz (admin uchun)
  // ============================================================
  async getById(id: string, userId?: string): Promise<TrainingCenterResponse> {
    const enrolledSubquery = userId
      ? `(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${userId}') IS NOT NULL`
      : 'FALSE';

    const userRatingSubquery = userId
      ? `(SELECT cr.rating FROM center_ratings cr WHERE cr.center_id = tc.id AND cr.user_id = '${userId}' LIMIT 1)`
      : 'NULL';

    const result = await this.pool.query(
      `SELECT
         tc.*,
         u.id               AS owner_id,
         u.telegram_username AS owner_username,
         u.telegram_first_name AS owner_first_name,
         ${enrolledSubquery}   AS is_enrolled,
         ${userRatingSubquery} AS user_rating
       FROM training_centers tc
       LEFT JOIN users u ON u.id = tc.owner_id
       WHERE tc.id = $1`,
      [id],
    );

    if (!result.rows.length) {
      throw new NotFoundException('Training center not found');
    }

    return this.formatCenter(result.rows[0]);
  }

  // ============================================================
  // PRIVATE: DB row → API response
  // ============================================================
  private formatCenter(row: Record<string, unknown>): TrainingCenterResponse {
    const toStr = (val: unknown): string | null => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'string') return val;
      if (typeof val === 'number' || typeof val === 'boolean')
        return String(val);
      return null;
    };

    return {
      id: row.id as string,
      owner: {
        id: (row.owner_id as string) ?? '',
        username:
          (row.owner_username as string) ??
          (row.owner_first_name as string) ??
          'Owner',
        avatar: null,
      },
      name: row.name as string,
      description: (row.description as string) ?? '',
      city: toStr(row.city),
      address: toStr(row.address),
      phone: toStr(row.phone),
      telegram: toStr(row.telegram),
      website: toStr(row.website),
      logo_url: toStr(row.logo_url),
      status: row.status as 'pending' | 'approved' | 'rejected',
      is_listed: Boolean(row.is_listed),
      rating: Number(row.rating ?? 0),
      rating_count: Number(row.rating_count ?? 0),
      students_count: Number(row.students_count ?? 0),
      rejection_reason: toStr(row.rejection_reason),
      approved_at: toStr(row.approved_at),
      created_at: toStr(row.created_at) ?? new Date().toISOString(),
      is_enrolled: Boolean(row.is_enrolled),
      user_rating: row.user_rating != null ? Number(row.user_rating) : null,
    };
  }
}
