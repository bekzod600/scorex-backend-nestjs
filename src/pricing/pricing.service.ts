import { Injectable } from '@nestjs/common';
import { PriceCacheService } from './price-cache.service';
import { ActiveSymbolsService } from './active-symbols.service';
import { YahooPriceProvider } from './providers/yahoo.provider';
// import Redis from 'ioredis';

@Injectable()
export class PricingService {
  private readonly provider = new YahooPriceProvider();

  constructor(
    // @Optional() @Inject('REDIS') private readonly redis: Redis,
    private readonly cache: PriceCacheService,
    private readonly active: ActiveSymbolsService,
  ) {}

  async getPrice(symbol: string) {
    // const redisKey = `price:${symbol}`;

    // 1️⃣ Redis (HOT)
    // const cachedRedis = await this.redis.get(redisKey);
    // if (cachedRedis) {
    //   return JSON.parse(cachedRedis);
    // }

    // 1️⃣ mark symbol as active
    await this.active.touch(symbol);

    // 2️⃣ check cache
    const cached = await this.cache.get(symbol);
    if (cached) {
      return cached;
    }

    // 3️⃣ fetch + cache
    const fresh = await this.provider.getPrice(symbol);
    await this.cache.upsert(
      symbol,
      fresh.price,
      fresh.currency,
      fresh.marketTime,
    );
    // await this.redis.set(redisKey, JSON.stringify(fresh), 'EX', 10);

    return fresh;
  }
}
