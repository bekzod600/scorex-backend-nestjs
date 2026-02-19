import {
  IsString,
  IsBoolean,
  IsOptional,
  // IsUrl,
  MinLength,
  MaxLength,
} from 'class-validator';

// ============================================================
// CREATE NEWS POST DTO
// ============================================================
export class CreateNewsPostDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary: string;

  @IsString()
  @MinLength(10)
  content: string;

  @IsOptional()
  @IsString()
  cover_image?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

// ============================================================
// UPDATE NEWS POST DTO
// ============================================================
export class UpdateNewsPostDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  content?: string;

  @IsOptional()
  @IsString()
  cover_image?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

// ============================================================
// RESPONSE TYPES
// ============================================================
export interface NewsPostResponse {
  id: string;
  title: string;
  summary: string;
  content: string;
  cover_image: string | null;
  published: boolean;
  author_id: string;
  author_username: string;
  created_at: string;
  updated_at: string;
}

export interface NewsListResponse {
  posts: NewsPostResponse[];
  total: number;
  page: number;
  limit: number;
}
