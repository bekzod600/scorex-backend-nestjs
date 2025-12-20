import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import Redis from 'ioredis';

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.ttl(key);
    multi.expire(key, ttl);
    const [, count, redisTtl] = (await multi.exec()) as any;
    const totalHits = Number(count[1]);
    const expiresIn = Number(redisTtl[1]);
    return {
      totalHits,
      timeToExpire: expiresIn > 0 ? expiresIn : ttl,
      isBlocked: totalHits > limit,
      timeToBlockExpire: totalHits > limit ? blockDuration : 0,
    };
  }
}
