import { Injectable } from '@nestjs/common';
import { FiltersService } from './filters.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class FilterMatcherService {
  constructor(
    private readonly filtersService: FiltersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async onNewSignal(signal: any) {
    const filters = await this.filtersService.getActiveFilters();

    for (const f of filters) {
      if (f.signal_type !== 'ANY' && f.signal_type !== signal.access_type)
        continue;
      if (f.max_price && signal.price && signal.price > f.max_price) continue;
      if (f.min_scorex && signal.seller_scorex < f.min_scorex) continue;

      await this.notificationsService.create(
        f.user_id as string,
        'FILTER_MATCH',
        `New signal matched: ${signal.ticker ?? '***'}`,
      );
    }
  }
}
