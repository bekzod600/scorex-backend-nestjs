// src/training-centers/dto/training-centers.dto.ts
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class RegisterCenterDto {
  @IsString() @MinLength(3) @MaxLength(255) name: string;
  @IsString() @MinLength(10) @MaxLength(2000) description: string;
  @IsString() @MinLength(2) @MaxLength(100) city: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsString() @MinLength(7) @MaxLength(50) phone: string;
  @IsOptional() @IsString() @MaxLength(100) telegram?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() logo_url?: string;
}

export class UpdateCenterDto {
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(50) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) telegram?: string;
  @IsOptional() @IsString() @MaxLength(500) website?: string;
  @IsOptional() @IsString() logo_url?: string;
}

export class RateCenterDto {
  @IsInt() @Min(1) @Max(5) rating: number;
}

export class RejectCenterDto {
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class ReviewEnrollmentDto {
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

// ============================================================
// RESPONSE TYPES
// ============================================================
export interface CenterOwner {
  id: string;
  username: string;
  avatar: string | null;
}

export interface CenterStudent {
  user_id: string;
  username: string;
  avatar: string | null;
  enrolled_at: string;
}

// Enrollment so'rovi (owner ko'radi)
export interface EnrollmentRequest {
  id: string;
  center_id: string;
  user_id: string;
  username: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at: string | null;
}

export interface TrainingCenterResponse {
  id: string;
  owner: CenterOwner;
  name: string;
  description: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  telegram: string | null;
  website: string | null;
  logo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_listed: boolean;
  rating: number;
  rating_count: number;
  students_count: number;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  // Auth context
  is_enrolled?: boolean;
  is_request_pending?: boolean; // pending so'rov bor (approved bo'lmagan)
  user_rating?: number | null;
  students?: CenterStudent[];
}

export interface CentersListResponse {
  centers: TrainingCenterResponse[];
  total: number;
  page: number;
  limit: number;
}
