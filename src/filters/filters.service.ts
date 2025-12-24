import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { CreateFilterDto } from './dto/create-filter.dto';

@Injectable()
export class FiltersService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async create(userId: string, dto: CreateFilterDto) {
    const { rows } = await this.pool.query(
      `
      INSERT INTO saved_filters
      (user_id, name, max_price, min_scorex, signal_type, is_active)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        userId,
        dto.name,
        dto.maxPrice ?? null,
        dto.minScoreX ?? null,
        dto.signalType ?? 'ANY',
        dto.isActive ?? true,
      ],
    );
    return rows[0];
  }

  async list(userId: string) {
    const { rows } = await this.pool.query(
      `SELECT * FROM saved_filters WHERE user_id = $1`,
      [userId],
    );
    return rows;
  }

  async getActiveFilters() {
    const { rows } = await this.pool.query(
      `SELECT * FROM saved_filters WHERE is_active = true`,
    );
    return rows;
  }
}
