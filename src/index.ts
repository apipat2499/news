import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { ConsoleNotifier } from './lib/notifier.js';
import { StaticPriceSource } from './lib/price-source.js';
import { StockAlertService } from './features/alerts/stock-alert-service.js';
import type { AlertDirection } from './features/alerts/types.js';

const cliSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  target: z.coerce.number().finite(),
  direction: z
    .enum(['above', 'below'] as [AlertDirection, AlertDirection])
    .default('above'),
  interval: z.coerce.number().int().positive().optional(),
  checks: z.coerce.number().int().positive().optional()
});

type CliInput = z.infer<typeof cliSchema>;

function parseArgs(argv: string[]): CliInput {
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

  return cliSchema.parse({
    symbol: flags.symbol,
    target: flags.target,
    direction: flags.direction,
    interval: flags.interval,
    checks: flags.checks
  });
}

function loadPriceData(): Record<string, number[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, '../public/assets/mock-prices.json');
  const content = readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content) as Record<string, number[]>;
  return data;
}

function printUsage(): void {
  console.log(`Usage: pnpm dev -- --symbol AAPL --target 192 --direction above [--interval 2000 --checks 5]`);
}

async function main(): Promise<void> {
  try {
    const input = parseArgs(process.argv.slice(2));
    const priceSource = new StaticPriceSource(loadPriceData());
    const notifier = new ConsoleNotifier();
    const service = new StockAlertService(priceSource, notifier);

    await service.monitor(
      {
        symbol: input.symbol,
        targetPrice: input.target,
        direction: input.direction
      },
      {
        intervalMs: input.interval ?? 2000,
        maxChecks: input.checks ?? 5
      }
    );
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

await main();
