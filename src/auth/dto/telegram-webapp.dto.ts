import { IsString } from 'class-validator';

/**
 * DTO for Telegram WebApp authentication
 * Frontend sends initData from Telegram.WebApp.initData
 */
export class TelegramWebAppAuthDto {
  @IsString()
  initData: string;
}

export interface WebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface WebAppInitData {
  query_id?: string;
  user?: WebAppUser;
  auth_date: number;
  hash: string;
}
