import { pathToFileURL } from 'url';
import {
  buildMonitorConfig,
  parseAlertRequest,
  type AlertRequestInput
} from '../features/alerts/input-schema.js';
import { StockAlertService } from '../features/alerts/stock-alert-service.js';
import { ConsoleNotifier } from '../lib/notifier.js';
import { StaticPriceSource } from '../lib/price-source.js';
import { loadMockPrices } from '../lib/load-mock-prices.js';

function parseArgs(argv: string[]): AlertRequestInput {
  const flags: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith('--')) {
      continue;
    }

    const key = current.slice(2);
    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = value;
    index += 1;
  }

  return parseAlertRequest({
    symbol: flags.symbol,
    target: flags.target,
    direction: flags.direction,
    interval: flags.interval,
    checks: flags.checks
  });
}

function printUsage(): void {
  console.log('Usage: pnpm dev -- --symbol AAPL --target 192 --direction above [--interval 2000 --checks 5]');
}

export async function runCli(argv = process.argv.slice(2)): Promise<void> {
  try {
    const input = parseArgs(argv);
    const { alertConfig, monitorOptions } = buildMonitorConfig(input);
    const priceSource = new StaticPriceSource(loadMockPrices());
    const notifier = new ConsoleNotifier();
    const service = new StockAlertService(priceSource, notifier);

    await service.monitor(alertConfig, monitorOptions);
  } catch (error) {
    printUsage();
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

const entryFileUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entryFileUrl === import.meta.url) {
  void runCli();
}
