import type { Notifier } from '../../lib/notifier.js';
import type { PriceSource } from '../../lib/price-source.js';
import type { AlertConfig, MonitorOptions } from './types.js';

export class StockAlertService {
  constructor(
    private readonly priceSource: PriceSource,
    private readonly notifier: Notifier
  ) {}

  async checkAndNotify(config: AlertConfig): Promise<boolean> {
    const price = await this.priceSource.getPrice(config.symbol);
    const shouldNotify =
      (config.direction === 'above' && price >= config.targetPrice) ||
      (config.direction === 'below' && price <= config.targetPrice);

    if (shouldNotify) {
      await this.notifier.notify(
        `📈 Alert: ${config.symbol.toUpperCase()} is ${price.toFixed(2)} (target ${
          config.direction
        } ${config.targetPrice.toFixed(2)})`
      );
      return true;
    }

    return false;
  }

  async monitor(config: AlertConfig, options: MonitorOptions = {}): Promise<void> {
    const { intervalMs = 5000, maxChecks = 10 } = options;

    for (let attempt = 0; attempt < maxChecks; attempt += 1) {
      const notified = await this.checkAndNotify(config);
      if (notified) {
        return;
      }

      await this.delay(intervalMs);
    }

    await this.notifier.notify(
      `ℹ️ Alert window ended for ${config.symbol.toUpperCase()} without triggering.`
    );
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
