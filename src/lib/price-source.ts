export interface PriceSource {
  getPrice(symbol: string): Promise<number>;
}

export class SequencePriceSource implements PriceSource {
  private readonly values: number[];
  private currentIndex = 0;

  constructor(values: number[]) {
    if (values.length === 0) {
      throw new Error('SequencePriceSource requires at least one price value');
    }

    this.values = values;
  }

  async getPrice(_symbol: string): Promise<number> {
    const price = this.values[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.values.length;
    return price;
  }
}

export class StaticPriceSource implements PriceSource {
  private sources: Map<string, SequencePriceSource> = new Map();

  constructor(private readonly prices: Record<string, number[]>) {}

  async getPrice(symbol: string): Promise<number> {
    const normalized = symbol.toUpperCase();
    if (!this.prices[normalized]) {
      throw new Error(`Unknown symbol: ${symbol}`);
    }

    if (!this.sources.has(normalized)) {
      this.sources.set(normalized, new SequencePriceSource(this.prices[normalized]));
    }

    const source = this.sources.get(normalized);
    if (!source) {
      throw new Error('Sequence source was unexpectedly undefined');
    }

    return source.getPrice(normalized);
  }
}
