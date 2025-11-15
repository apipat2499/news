import { StockAlertService } from '../../../src/features/alerts/stock-alert-service.js';
import type { AlertConfig } from '../../../src/features/alerts/types.js';
import type { Notifier } from '../../../src/lib/notifier.js';
import type { PriceSource } from '../../../src/lib/price-source.js';

describe('StockAlertService', () => {
  const createService = (prices: number[]): { service: StockAlertService; notifications: string[] } => {
    let index = 0;
    const priceSource: PriceSource = {
      async getPrice(_symbol: string): Promise<number> {
        const price = prices[Math.min(index, prices.length - 1)];
        index += 1;
        return price;
      }
    };

    const notifications: string[] = [];
    const notifier: Notifier = {
      async notify(message: string): Promise<void> {
        notifications.push(message);
      }
    };

    return { service: new StockAlertService(priceSource, notifier), notifications };
  };

  it('notifies when price reaches an above target', async () => {
    const { service, notifications } = createService([180, 190, 200]);
    const config: AlertConfig = { symbol: 'TEST', targetPrice: 195, direction: 'above' };

    await service.monitor(config, { intervalMs: 0, maxChecks: 5 });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('📈 Alert');
    expect(notifications[0]).toContain('Range: 180.00-200.00');
  });

  it('notifies when price reaches a below target', async () => {
    const { service, notifications } = createService([210, 205, 200, 190]);
    const config: AlertConfig = { symbol: 'TEST', targetPrice: 199, direction: 'below' };

    await service.monitor(config, { intervalMs: 0, maxChecks: 5 });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('target below');
    expect(notifications[0]).toContain('Range: 190.00-210.00');
  });

  it('emits end-of-window message when target not met', async () => {
    const { service, notifications } = createService([180, 181, 182]);
    const config: AlertConfig = { symbol: 'TEST', targetPrice: 200, direction: 'above' };

    await service.monitor(config, { intervalMs: 0, maxChecks: 3 });

    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toContain('Alert window ended');
    expect(notifications[0]).toContain('Range observed: 180.00-182.00');
  });
});
