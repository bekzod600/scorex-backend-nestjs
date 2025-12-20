import { Module } from '@nestjs/common';
import { PriceRefreshJob } from './price-refresh.job';
import { SignalEngineJob } from './signal-engine.job';
import { PricingModule } from '../pricing/pricing.module';
import { SignalsModule } from '../signals/signals.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [PricingModule, SignalsModule, DatabaseModule],
  providers: [PriceRefreshJob, SignalEngineJob],
})
export class JobsModule {}
