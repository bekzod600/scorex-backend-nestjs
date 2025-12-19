import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateFilterDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsNumber()
  minScoreX?: number;

  @IsOptional()
  @IsString()
  signalType?: 'FREE' | 'PAID' | 'ANY';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
