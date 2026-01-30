import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

export interface DbUser {
  id: string;
  email: string;
  password: string;
  name: string | null;
  role: 'user' | 'admin';
  score_x: number;
}

@Injectable()
export class UsersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<DbUser | null> {
    const { rows } = await this.pool.query<DbUser>(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findById(id: string): Promise<Omit<DbUser, 'password'> | null> {
    const { rows } = await this.pool.query<Omit<DbUser, 'password'>>(
      `SELECT id,email,name,role,score_x FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  }

  async createUser(
    email: string,
    password: string,
    name?: string,
  ): Promise<Omit<DbUser, 'password'>> {
    const { rows } = await this.pool.query<Omit<DbUser, 'password'>>(
      `
      INSERT INTO users (email, password, name)
      VALUES ($1, $2, $3)
      RETURNING id,email,name,role,score_x
      `,
      [email, password, name ?? null],
    );
    return rows[0];
  }

  /**
   * Get user's own signals
   */
  async getMySignals(userId: string, params?: { tab?: 'live' | 'results' }) {
    const tab = params?.tab || 'live';

    let statusFilter = '';
    if (tab === 'live') {
      statusFilter = `AND s.status IN ('WAIT_EP', 'IN_TRADE')`;
    } else if (tab === 'results') {
      statusFilter = `AND s.status IN ('CLOSED_TP', 'CLOSED_SL', 'CANCELED')`;
    }

    const { rows } = await this.pool.query(
      `
      SELECT s.*
      FROM signals s
      WHERE s.seller_id = $1
      ${statusFilter}
      ORDER BY s.created_at DESC
      `,
      [userId],
    );

    return {
      signals: rows.map((s) => ({
        ...s,
        isLocked: false,
        isPurchased: true,
      })),
      total: rows.length,
    };
  }
}
