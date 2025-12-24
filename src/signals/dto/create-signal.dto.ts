import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import type { SignalAccessType } from '../constants/signal.constants';

export class CreateSignalDto {
  @IsString()
  ticker: string;

  @IsEnum(['FREE', 'PAID'])
  accessType: SignalAccessType;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsNumber()
  ep: number;

  @IsNumber()
  tp1: number;

  @IsOptional()
  @IsNumber()
  tp2?: number;

  @IsNumber()
  sl: number;
}
