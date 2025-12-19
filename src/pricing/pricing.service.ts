import { Injectable } from '@nestjs/common';
import { PriceCacheService } from './price-cache.service';
import { ActiveSymbolsService } from './active-symbols.service';
import { YahooPriceProvider } from './providers/yahoo.provider';

@Injectable()
export class PricingService {
  private readonly provider = new YahooPriceProvider();

  constructor(
    private readonly cache: PriceCacheService,
    private readonly active: ActiveSymbolsService,
  ) {}

  async getPrice(symbol: string) {
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

    return fresh;
  }
}
