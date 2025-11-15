import type { Notifier } from '../../lib/notifier.js';
import type { PriceSource } from '../../lib/price-source.js';
import type { AlertConfig, MonitorOptions } from './types.js';

interface PriceStats {
  highestPrice: number;
  lowestPrice: number;
}

export class StockAlertService {
  constructor(
    private readonly priceSource: PriceSource,
    private readonly notifier: Notifier
  ) {}

  async checkAndNotify(config: AlertConfig): Promise<boolean> {
    const price = await this.priceSource.getPrice(config.symbol);
    if (this.shouldNotify(price, config)) {
      await this.notifier.notify(this.formatTriggerMessage(config, price));
      return true;
    }

    return false;
  }

  async monitor(config: AlertConfig, options: MonitorOptions = {}): Promise<void> {
    const { intervalMs = 5000, maxChecks = 10 } = options;
    let highestPrice: number | undefined;
    let lowestPrice: number | undefined;

    for (let attempt = 0; attempt < maxChecks; attempt += 1) {
      const price = await this.priceSource.getPrice(config.symbol);
      highestPrice =
        typeof highestPrice === 'number' ? Math.max(highestPrice, price) : price;
      lowestPrice =
        typeof lowestPrice === 'number' ? Math.min(lowestPrice, price) : price;

      if (this.shouldNotify(price, config)) {
        const stats = this.toPriceStats(highestPrice, lowestPrice);
        await this.notifier.notify(this.formatTriggerMessage(config, price, stats));
        return;
      }

      await this.delay(intervalMs);
    }

    const stats = this.toPriceStats(highestPrice, lowestPrice);
    await this.notifier.notify(
      this.formatTimeoutMessage(config.symbol.toUpperCase(), stats)
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private shouldNotify(price: number, config: AlertConfig): boolean {
    if (config.direction === 'above') {
      return price >= config.targetPrice;
    }

    return price <= config.targetPrice;
  }

  private formatTriggerMessage(
    config: AlertConfig,
    price: number,
    stats?: PriceStats
  ): string {
    const base = `📈 Alert: ${config.symbol.toUpperCase()} is ${price.toFixed(2)} (target ${
      config.direction
    } ${config.targetPrice.toFixed(2)})`;

    if (!stats) {
      return base;
    }

    return `${base} | Range: ${stats.lowestPrice.toFixed(2)}-${stats.highestPrice.toFixed(2)}`;
  }

  private formatTimeoutMessage(symbol: string, stats?: PriceStats): string {
    const base = `ℹ️ Alert window ended for ${symbol} without triggering.`;

    if (!stats) {
      return base;
    }

    return `${base} Range observed: ${stats.lowestPrice.toFixed(2)}-${stats.highestPrice.toFixed(
      2
    )}.`;
  }

  private toPriceStats(
    highestPrice: number | undefined,
    lowestPrice: number | undefined
  ): PriceStats | undefined {
    if (typeof highestPrice !== 'number' || typeof lowestPrice !== 'number') {
      return undefined;
    }

    return { highestPrice, lowestPrice };
  }
}
