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
}
