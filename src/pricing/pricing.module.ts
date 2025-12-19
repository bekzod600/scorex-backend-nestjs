import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PriceCacheService } from './price-cache.service';
import { ActiveSymbolsService } from './active-symbols.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [PricingService, PriceCacheService, ActiveSymbolsService],
  exports: [PricingService, ActiveSymbolsService],
})
export class PricingModule {}
