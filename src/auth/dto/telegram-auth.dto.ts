import { IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';

/**
 * DTO for initiating login from website
 */
export class InitiateTelegramLoginDto {
  // No body needed - backend generates login_id
}

/**
 * DTO for bot confirming login
 */
export class ConfirmTelegramLoginDto {
  @IsUUID()
  loginId: string;

  @IsNumber()
  telegramId: number;

  @IsOptional()
  @IsString()
  telegramUsername?: string;

  @IsOptional()
  @IsString()
  telegramFirstName?: string;

  @IsOptional()
  @IsString()
  telegramLastName?: string;
}

/**
 * Response for login initiation
 */
export interface TelegramLoginResponse {
  loginId: string;
  botUsername: string;
  deepLink: string;
  expiresIn: number; // seconds
}

/**
 * Response for login confirmation
 */
export interface LoginConfirmedResponse {
  success: boolean;
  accessToken: string;
  user: {
    id: string;
    telegramId: number;
    telegramUsername?: string;
    role: string;
  };
}
