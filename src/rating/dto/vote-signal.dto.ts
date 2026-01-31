// src/rating/dto/vote-signal.dto.ts
import { IsEnum } from 'class-validator';

export enum VoteType {
  LIKE = 'like',
  DISLIKE = 'dislike',
}

export class VoteSignalDto {
  @IsEnum(VoteType)
  vote: VoteType;
}

