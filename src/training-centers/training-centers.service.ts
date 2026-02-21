// src/training-centers/training-centers.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import type {
  RegisterCenterDto,
  UpdateCenterDto,
  TrainingCenterResponse,
  CentersListResponse,
  EnrollmentRequest,
} from './dto/training-centers.dto';

@Injectable()
export class TrainingCentersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // ============================================================
  // PUBLIC: Tasdiqlangan markazlar ro'yxati
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

    // is_enrolled: faqat APPROVED enrollment bo'lsa true
    // is_request_pending: pending so'rov bormi
    const enrolledSub = params.userId
      ? `EXISTS(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${params.userId}' AND ce.status = 'approved')`
      : 'FALSE';

    const pendingSub = params.userId
      ? `EXISTS(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${params.userId}' AND ce.status = 'pending')`
      : 'FALSE';

    const userRatingSub = params.userId
      ? `(SELECT cr.rating FROM center_ratings cr WHERE cr.center_id = tc.id AND cr.user_id = '${params.userId}' LIMIT 1)`
      : 'NULL';

    const [listResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT
           tc.id, tc.name, tc.description, tc.city, tc.address,
           tc.phone, tc.telegram, tc.website, tc.logo_url,
           tc.status, tc.is_listed, tc.rating, tc.rating_count,
           tc.students_count, tc.rejection_reason, tc.approved_at,
           tc.created_at,
           u.id               AS owner_id,
           u.telegram_username AS owner_username,
           u.telegram_first_name AS owner_first_name,
           ${enrolledSub}    AS is_enrolled,
           ${pendingSub}     AS is_request_pending,
           ${userRatingSub}  AS user_rating
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
  // ============================================================
  async getApproved(
    id: string,
    userId?: string,
  ): Promise<TrainingCenterResponse> {
    const center = await this.getById(id, userId);
    if (center.status !== 'approved' || !center.is_listed) {
      throw new NotFoundException('Training center not found');
    }

    // Faqat approved studentlar
    const studentsResult = await this.pool.query(
      `SELECT
         ce.user_id,
         u.telegram_username AS username,
         u.telegram_first_name AS first_name,
         ce.created_at AS enrolled_at
       FROM center_enrollments ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.center_id = $1 AND ce.status = 'approved'
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
  // ============================================================
  async register(
    userId: string,
    dto: RegisterCenterDto,
  ): Promise<TrainingCenterResponse> {
    const existing = await this.pool.query(
      `SELECT id FROM training_centers WHERE owner_id = $1`,
      [userId],
    );
    if (existing.rows.length) {
      throw new ConflictException(
        'You already have a registered training center',
      );
    }

    await this.pool.query(
      `INSERT INTO training_centers
         (owner_id, name, description, city, address, phone, telegram, website, logo_url, status, is_listed)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', TRUE)`,
      [
        userId,
        dto.name,
        dto.description,
        dto.city ?? null,
        dto.address ?? null,
        dto.phone ?? null,
        dto.telegram ?? null,
        dto.website ?? null,
        dto.logo_url ?? null,
      ],
    );

    return (await this.getMy(userId))!;
  }

  // ============================================================
  // AUTH: Owner o'z markazini yangilashi
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

    const centerId = existing.rows[0].id as string;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const addField = (col: string, val: unknown) => {
      if (val !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(val);
      }
    };
    addField('description', dto.description);
    addField('address', dto.address);
    addField('phone', dto.phone);
    addField('telegram', dto.telegram);
    addField('website', dto.website);
    addField('logo_url', dto.logo_url);

    if (fields.length) {
      values.push(centerId);
      await this.pool.query(
        `UPDATE training_centers SET ${fields.join(', ')} WHERE id = $${idx}`,
        values,
      );
    }

    return (await this.getMy(userId))!;
  }

  // ============================================================
  // AUTH: Owner o'z markazini o'chiradi
  // DELETE /training-centers/my
  // ============================================================
  async deleteMy(userId: string): Promise<{ success: boolean }> {
    const { rows } = await this.pool.query(
      `SELECT id FROM training_centers WHERE owner_id = $1`,
      [userId],
    );

    if (!rows.length) {
      throw new NotFoundException('You do not have a training center');
    }

    await this.pool.query(`DELETE FROM training_centers WHERE owner_id = $1`, [
      userId,
    ]);

    return { success: true };
  }

  // ============================================================
  // AUTH: "Studied here" SO'ROV yuborish (to'g'ridan enrollment emas!)
  // POST /training-centers/:id/enroll
  // ============================================================
  async requestEnroll(
    centerId: string,
    userId: string,
  ): Promise<{ status: 'pending'; message: string }> {
    // Markaz mavjud va approved'mi?
    const centerRes = await this.pool.query(
      `SELECT id, owner_id FROM training_centers WHERE id = $1 AND status = 'approved'`,
      [centerId],
    );
    if (!centerRes.rows.length)
      throw new NotFoundException('Training center not found');

    const center = centerRes.rows[0] as { id: string; owner_id: string };

    // Owner o'z markaziga so'rov yubora olmaydi
    if (center.owner_id === userId) {
      throw new ForbiddenException('You cannot enroll in your own center');
    }

    // Allaqachon so'rov yoki enrollment bormi?
    const existing = await this.pool.query(
      `SELECT id, status FROM center_enrollments
       WHERE center_id = $1 AND user_id = $2`,
      [centerId, userId],
    );
    if (existing.rows.length) {
      const existingStatus = existing.rows[0].status as string;
      if (existingStatus === 'approved') {
        throw new ConflictException('You are already a student of this center');
      }
      if (existingStatus === 'pending') {
        throw new ConflictException('Your request is already pending approval');
      }
      // rejected → qayta so'rov yuborish mumkin
      await this.pool.query(
        `UPDATE center_enrollments SET status = 'pending', reviewed_at = NULL
         WHERE center_id = $1 AND user_id = $2`,
        [centerId, userId],
      );
    } else {
      await this.pool.query(
        `INSERT INTO center_enrollments (center_id, user_id, status) VALUES ($1, $2, 'pending')`,
        [centerId, userId],
      );
    }

    return {
      status: 'pending',
      message:
        "So'rovingiz qabul qilindi. O'quv markaz egasi tasdiqlagan so'ng studentga aylanasiz.",
    };
  }

  // ============================================================
  // AUTH: So'rovni bekor qilish
  // DELETE /training-centers/:id/enroll
  // ============================================================
  async cancelEnroll(
    centerId: string,
    userId: string,
  ): Promise<{ cancelled: boolean }> {
    await this.pool.query(
      `DELETE FROM center_enrollments
       WHERE center_id = $1 AND user_id = $2 AND status IN ('pending', 'approved')`,
      [centerId, userId],
    );
    return { cancelled: true };
  }

  // ============================================================
  // OWNER: Pending so'rovlar ro'yxati
  // GET /training-centers/my/enrollment-requests
  // ============================================================
  async getMyEnrollmentRequests(ownerId: string): Promise<EnrollmentRequest[]> {
    const centerRes = await this.pool.query(
      `SELECT id FROM training_centers WHERE owner_id = $1`,
      [ownerId],
    );
    if (!centerRes.rows.length) return [];

    const centerId = centerRes.rows[0].id as string;

    const result = await this.pool.query(
      `SELECT
         ce.id,
         ce.center_id,
         ce.user_id,
         ce.status,
         ce.created_at,
         ce.reviewed_at,
         u.telegram_username AS username,
         u.telegram_first_name AS first_name
       FROM center_enrollments ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.center_id = $1
       ORDER BY
         CASE ce.status WHEN 'pending' THEN 0 ELSE 1 END,
         ce.created_at DESC`,
      [centerId],
    );

    return result.rows.map((r) => ({
      id: r.id as string,
      center_id: r.center_id as string,
      user_id: r.user_id as string,
      username: (r.username as string) ?? (r.first_name as string) ?? 'User',
      status: r.status as 'pending' | 'approved' | 'rejected',
      created_at:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      reviewed_at: r.reviewed_at
        ? r.reviewed_at instanceof Date
          ? r.reviewed_at.toISOString()
          : String(r.reviewed_at)
        : null,
    }));
  }

  // ============================================================
  // OWNER: So'rovni tasdiqlash
  // PATCH /training-centers/my/enrollment-requests/:requestId/approve
  // ============================================================
  async approveEnrollment(
    requestId: string,
    ownerId: string,
  ): Promise<{ success: boolean }> {
    // Owner o'zining markaziga tegishli ekanligini tekshir
    const res = await this.pool.query(
      `SELECT ce.id FROM center_enrollments ce
       JOIN training_centers tc ON tc.id = ce.center_id
       WHERE ce.id = $1 AND tc.owner_id = $2 AND ce.status = 'pending'`,
      [requestId, ownerId],
    );
    if (!res.rows.length) {
      throw new NotFoundException(
        'Enrollment request not found or already processed',
      );
    }

    await this.pool.query(
      `UPDATE center_enrollments
       SET status = 'approved', reviewed_at = NOW()
       WHERE id = $1`,
      [requestId],
    );

    return { success: true };
  }

  // ============================================================
  // OWNER: So'rovni rad etish
  // PATCH /training-centers/my/enrollment-requests/:requestId/reject
  // ============================================================
  async rejectEnrollment(
    requestId: string,
    ownerId: string,
    note?: string,
  ): Promise<{ success: boolean }> {
    const res = await this.pool.query(
      `SELECT ce.id FROM center_enrollments ce
       JOIN training_centers tc ON tc.id = ce.center_id
       WHERE ce.id = $1 AND tc.owner_id = $2 AND ce.status = 'pending'`,
      [requestId, ownerId],
    );
    if (!res.rows.length) {
      throw new NotFoundException(
        'Enrollment request not found or already processed',
      );
    }

    await this.pool.query(
      `UPDATE center_enrollments
       SET status = 'rejected', reviewed_at = NOW(), owner_note = $2
       WHERE id = $1`,
      [requestId, note ?? null],
    );

    return { success: true };
  }

  // ============================================================
  // REYTING
  // ============================================================
  async rate(
    centerId: string,
    userId: string,
    rating: number,
  ): Promise<{
    rating: number;
    rating_count: number;
    user_rating: number;
  }> {
    const centerRes = await this.pool.query(
      `SELECT id FROM training_centers WHERE id = $1 AND status = 'approved'`,
      [centerId],
    );
    if (!centerRes.rows.length)
      throw new NotFoundException('Training center not found');

    if (rating < 1 || rating > 5)
      throw new BadRequestException('Rating must be 1-5');

    await this.pool.query(
      `INSERT INTO center_ratings (center_id, user_id, rating)
       VALUES ($1, $2, $3)
       ON CONFLICT (center_id, user_id)
       DO UPDATE SET rating = $3, updated_at = NOW()`,
      [centerId, userId, rating],
    );

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
  // ADMIN METHODS
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
        `SELECT tc.*, u.id AS owner_id, u.telegram_username AS owner_username,
                u.telegram_first_name AS owner_first_name
         FROM training_centers tc
         LEFT JOIN users u ON u.id = tc.owner_id
         ${where}
         ORDER BY CASE tc.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, tc.created_at DESC
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

  async adminApprove(
    centerId: string,
    adminId: string,
  ): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers
       SET status='approved', is_listed=TRUE, approved_at=NOW(), reviewed_by=$2, rejection_reason=NULL
       WHERE id=$1 RETURNING id`,
      [centerId, adminId],
    );
    if (!result.rows.length)
      throw new NotFoundException('Training center not found');
    return this.getById(centerId);
  }

  async adminReject(
    centerId: string,
    adminId: string,
    reason?: string,
  ): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers
       SET status='rejected', is_listed=FALSE, reviewed_by=$2, rejection_reason=$3
       WHERE id=$1 RETURNING id`,
      [centerId, adminId, reason ?? null],
    );
    if (!result.rows.length)
      throw new NotFoundException('Training center not found');
    return this.getById(centerId);
  }

  async adminToggleListing(centerId: string): Promise<TrainingCenterResponse> {
    const result = await this.pool.query(
      `UPDATE training_centers SET is_listed = NOT is_listed
       WHERE id=$1 AND status='approved' RETURNING id`,
      [centerId],
    );
    if (!result.rows.length)
      throw new NotFoundException('Approved training center not found');
    return this.getById(centerId);
  }

  // ============================================================
  // PRIVATE: ID bo'yicha markaz (har qanday status)
  // ============================================================
  async getById(id: string, userId?: string): Promise<TrainingCenterResponse> {
    const enrolledSub = userId
      ? `EXISTS(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${userId}' AND ce.status = 'approved')`
      : 'FALSE';

    const pendingSub = userId
      ? `EXISTS(SELECT 1 FROM center_enrollments ce WHERE ce.center_id = tc.id AND ce.user_id = '${userId}' AND ce.status = 'pending')`
      : 'FALSE';

    const userRatingSub = userId
      ? `(SELECT cr.rating FROM center_ratings cr WHERE cr.center_id = tc.id AND cr.user_id = '${userId}' LIMIT 1)`
      : 'NULL';

    const result = await this.pool.query(
      `SELECT tc.*, u.id AS owner_id, u.telegram_username AS owner_username,
              u.telegram_first_name AS owner_first_name,
              ${enrolledSub}  AS is_enrolled,
              ${pendingSub}   AS is_request_pending,
              ${userRatingSub} AS user_rating
       FROM training_centers tc
       LEFT JOIN users u ON u.id = tc.owner_id
       WHERE tc.id = $1`,
      [id],
    );
    if (!result.rows.length)
      throw new NotFoundException('Training center not found');
    return this.formatCenter(result.rows[0]);
  }

  // ============================================================
  // PRIVATE: DB row → API response
  // ============================================================
  private formatCenter(row: Record<string, unknown>): TrainingCenterResponse {
    const toStr = (v: unknown): string | null => {
      if (v == null) return null;
      if (v instanceof Date) return v.toISOString();
      if (typeof v === 'string') return v;
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
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
      is_request_pending: Boolean(row.is_request_pending),
      user_rating: row.user_rating != null ? Number(row.user_rating) : null,
    };
  }
}
