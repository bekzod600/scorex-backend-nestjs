import { Injectable } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import { ActiveSymbolsService } from '../pricing/active-symbols.service';

@Injectable()
export class PriceRefreshJob {
  constructor(
    private readonly pricingService: PricingService,
    private readonly active: ActiveSymbolsService,
  ) {}

  async run() {
    const symbols = await this.active.list(10);

    for (const symbol of symbols) {
      await this.pricingService.getPrice(symbol);
    }
  }
}
