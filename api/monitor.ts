import {
  buildMonitorConfig,
  validateAlertRequest
} from '../src/features/alerts/input-schema.js';
import { StockAlertService } from '../src/features/alerts/stock-alert-service.js';
import type { Notifier } from '../src/lib/notifier.js';
import { StaticPriceSource } from '../src/lib/price-source.js';
import { loadMockPrices } from '../src/lib/load-mock-prices.js';

type HttpQuery = Record<string, string | string[]>;

interface HttpRequest {
  method?: string;
  query?: HttpQuery;
  body?: unknown;
}

interface HttpResponse {
  setHeader(name: string, value: string): void;
  status(statusCode: number): HttpResponse;
  json(body: unknown): void;
}

class MemoryNotifier implements Notifier {
  readonly messages: string[] = [];

  async notify(message: string): Promise<void> {
    this.messages.push(message);
  }
}

function normalizePayload(req: HttpRequest): unknown {
  if (req.method === 'POST') {
    return req.body ?? {};
  }

  return req.query ?? {};
}

export default async function handler(req: HttpRequest, res: HttpResponse): Promise<void> {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const payload = normalizePayload(req);
  const parsed = validateAlertRequest(payload);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request payload',
      details: parsed.errors
    });
    return;
  }

  const { alertConfig, monitorOptions } = buildMonitorConfig(parsed.data);
  const cappedOptions = {
    intervalMs: Math.min(monitorOptions.intervalMs ?? 2000, 10_000),
    maxChecks: Math.min(monitorOptions.maxChecks ?? 5, 20)
  };

  const notifier = new MemoryNotifier();
  const priceSource = new StaticPriceSource(loadMockPrices());
  const service = new StockAlertService(priceSource, notifier);

  try {
    await service.monitor(alertConfig, cappedOptions);
    const triggered = notifier.messages.some((message) => message.startsWith('📈'));

    res.status(200).json({
      triggered,
      notifications: notifier.messages,
      config: alertConfig,
      options: cappedOptions
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: 'Unexpected error while monitoring prices' });
  }
}
