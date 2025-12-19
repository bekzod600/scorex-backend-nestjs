import { Injectable, BadRequestException } from '@nestjs/common';
import { SignalsService } from '../signals.service';
import { SignalStatus } from '../constants/signal.constants';
import { RatingService } from '../../rating/rating.service';

@Injectable()
export class SignalEngineService {
  constructor(
    private readonly signalsService: SignalsService,
    private readonly ratingService: RatingService,
  ) {}

  async markEntered(signalId: string) {
    return this.transition(signalId, 'IN_TRADE');
  }

  async markTp(signalId: string) {
    return this.transition(signalId, 'CLOSED_TP');
  }

  async markSl(signalId: string) {
    return this.transition(signalId, 'CLOSED_SL');
  }

  async cancel(signalId: string) {
    return this.transition(signalId, 'CANCELED');
  }

  private async transition(signalId: string, to: SignalStatus) {
    const signal = await this.signalsService.findById(signalId);
    if (!signal) throw new BadRequestException('Signal not found');

    // Guard rules
    if (signal.status === 'CANCELED' || signal.status.startsWith('CLOSED')) {
      throw new BadRequestException('Signal already finished');
    }

    if (to === 'IN_TRADE' && signal.status !== 'WAIT_EP') {
      throw new BadRequestException('Invalid transition');
    }

    if (
      (to === 'CLOSED_TP' || to === 'CLOSED_SL') &&
      signal.status !== 'IN_TRADE'
    ) {
      throw new BadRequestException('Invalid transition');
    }

    // return this.signalsService.updateStatus(signalId, to);
    const updated = await this.signalsService.updateStatus(signalId, to);

    if (to === 'CLOSED_TP' || to === 'CLOSED_SL' || to === 'CANCELED') {
      await this.ratingService.applyForSignal(signalId);
    }

    return updated;
  }
}
