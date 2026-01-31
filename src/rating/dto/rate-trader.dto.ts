// src/rating/dto/rate-trader.dto.ts
import { IsInt, Min, Max } from 'class-validator';

export class RateTraderDto {
  @IsInt()
  @Min(1)
  @Max(5)
  stars: number;
}

