import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Pool } from 'pg';
import type {
  CreateNewsPostDto,
  UpdateNewsPostDto,
  NewsPostResponse,
  NewsListResponse,
} from './dto/news.dto';

@Injectable()
export class NewsService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  // ============================================================
  // PUBLIC: List published news posts (paginated)
  // GET /news
  // ============================================================
  async listPublished(page = 1, limit = 20): Promise<NewsListResponse> {
    const offset = (page - 1) * limit;

    const [postsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT
           np.id,
           np.title,
           np.summary,
           np.content,
           np.cover_image,
           np.published,
           np.author_id,
           u.telegram_username AS author_username,
           np.created_at,
           np.updated_at
         FROM news_posts np
         LEFT JOIN users u ON u.id = np.author_id
         WHERE np.published = TRUE
         ORDER BY np.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*) FROM news_posts WHERE published = TRUE`),
    ]);

    return {
      posts: postsResult.rows.map((row) => this.formatPost(row)),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  // ============================================================
  // PUBLIC: Get single published post
  // GET /news/:id
  // ============================================================
  async getPublished(id: string): Promise<NewsPostResponse> {
    const result = await this.pool.query(
      `SELECT
         np.id,
         np.title,
         np.summary,
         np.content,
         np.cover_image,
         np.published,
         np.author_id,
         u.telegram_username AS author_username,
         np.created_at,
         np.updated_at
       FROM news_posts np
       LEFT JOIN users u ON u.id = np.author_id
       WHERE np.id = $1 AND np.published = TRUE`,
      [id],
    );

    if (!result.rows.length) {
      throw new NotFoundException('News post not found');
    }

    return this.formatPost(result.rows[0]);
  }

  // ============================================================
  // ADMIN: List ALL posts (including drafts), paginated
  // GET /admin/news
  // ============================================================
  async listAll(page = 1, limit = 20): Promise<NewsListResponse> {
    const offset = (page - 1) * limit;

    const [postsResult, countResult] = await Promise.all([
      this.pool.query(
        `SELECT
           np.id,
           np.title,
           np.summary,
           np.content,
           np.cover_image,
           np.published,
           np.author_id,
           u.telegram_username AS author_username,
           np.created_at,
           np.updated_at
         FROM news_posts np
         LEFT JOIN users u ON u.id = np.author_id
         ORDER BY np.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset],
      ),
      this.pool.query(`SELECT COUNT(*) FROM news_posts`),
    ]);

    return {
      posts: postsResult.rows.map((row) => this.formatPost(row)),
      total: parseInt(countResult.rows[0].count, 10),
      page,
      limit,
    };
  }

  // ============================================================
  // ADMIN: Get single post (any status)
  // GET /admin/news/:id
  // ============================================================
  async getById(id: string): Promise<NewsPostResponse> {
    const result = await this.pool.query(
      `SELECT
         np.id,
         np.title,
         np.summary,
         np.content,
         np.cover_image,
         np.published,
         np.author_id,
         u.telegram_username AS author_username,
         np.created_at,
         np.updated_at
       FROM news_posts np
       LEFT JOIN users u ON u.id = np.author_id
       WHERE np.id = $1`,
      [id],
    );

    if (!result.rows.length) {
      throw new NotFoundException('News post not found');
    }

    return this.formatPost(result.rows[0]);
  }

  // ============================================================
  // ADMIN: Create news post
  // POST /admin/news
  // ============================================================
  async create(
    authorId: string,
    dto: CreateNewsPostDto,
  ): Promise<NewsPostResponse> {
    const result = await this.pool.query(
      `INSERT INTO news_posts
         (title, summary, content, cover_image, published, author_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        dto.title,
        dto.summary,
        dto.content,
        dto.cover_image ?? null,
        dto.published ?? false,
        authorId,
      ],
    );

    const post = result.rows[0];

    // Fetch author username
    const userResult = await this.pool.query(
      `SELECT telegram_username FROM users WHERE id = $1`,
      [authorId],
    );

    return this.formatPost({
      ...post,
      author_username: userResult.rows[0]?.telegram_username ?? 'Admin',
    });
  }

  // ============================================================
  // ADMIN: Update news post
  // PATCH /admin/news/:id
  // ============================================================
  async update(
    id: string,
    requesterId: string,
    requesterRole: string,
    dto: UpdateNewsPostDto,
  ): Promise<NewsPostResponse> {
    // Check post exists
    const existing = await this.getById(id);

    // Only super_admin or the original author can update
    if (requesterRole !== 'super_admin' && existing.author_id !== requesterId) {
      throw new ForbiddenException('You cannot edit this post');
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (dto.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(dto.title);
    }
    if (dto.summary !== undefined) {
      fields.push(`summary = $${idx++}`);
      values.push(dto.summary);
    }
    if (dto.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(dto.content);
    }
    if (dto.cover_image !== undefined) {
      fields.push(`cover_image = $${idx++}`);
      values.push(dto.cover_image);
    }
    if (dto.published !== undefined) {
      fields.push(`published = $${idx++}`);
      values.push(dto.published);
    }

    if (!fields.length) return existing;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await this.pool.query(
      `UPDATE news_posts SET ${fields.join(', ')} WHERE id = $${idx}`,
      values,
    );

    return this.getById(id);
  }

  // ============================================================
  // ADMIN: Toggle publish status
  // PATCH /admin/news/:id/toggle-publish
  // ============================================================
  async togglePublish(id: string): Promise<NewsPostResponse> {
    const result = await this.pool.query(
      `UPDATE news_posts
       SET published = NOT published, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    if (!result.rows.length) {
      throw new NotFoundException('News post not found');
    }

    return this.getById(id);
  }

  // ============================================================
  // ADMIN: Delete news post
  // DELETE /admin/news/:id
  // ============================================================
  async delete(id: string): Promise<{ success: boolean }> {
    const result = await this.pool.query(
      `DELETE FROM news_posts WHERE id = $1`,
      [id],
    );

    if (result.rowCount === 0) {
      throw new NotFoundException('News post not found');
    }

    return { success: true };
  }

  // ============================================================
  // PRIVATE: Format DB row → API response
  // ============================================================
  private formatPost(row: Record<string, unknown>): NewsPostResponse {
    return {
      id: row.id as string,
      title: row.title as string,
      summary: row.summary as string,
      content: row.content as string,
      cover_image: (row.cover_image as string) ?? null,
      published: row.published as boolean,
      author_id: row.author_id as string,
      author_username: (row.author_username as string) ?? 'ScoreX Team',
      created_at:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
      updated_at:
        row.updated_at instanceof Date
          ? row.updated_at.toISOString()
          : String(row.updated_at),
    };
  }
}
