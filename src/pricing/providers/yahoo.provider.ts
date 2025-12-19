import { PriceProvider } from './price-provider.interface';

export class YahooPriceProvider implements PriceProvider {
  async getPrice(symbol: string) {
    // hozircha stub (keyin real API ulanadi)
    return {
      price: Math.random() * 100 + 50,
      currency: 'USD',
      marketTime: new Date(),
    };
  }
}
