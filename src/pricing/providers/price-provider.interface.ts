export interface PriceProvider {
  getPrice(symbol: string): Promise<{
    price: number;
    currency: string;
    marketTime?: Date;
  }>;
}
