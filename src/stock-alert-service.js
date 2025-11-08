import { DEFAULT_INTERVAL_MS, DEFAULT_MAX_CHECKS } from './config.js';

/**
 * Create a reusable price source that cycles through the provided price history.
 * @param {Record<string, number[]>} priceMap mapping of symbol to sequential prices
 */
export function createMockPriceSource(priceMap) {
  const normalized = new Map(
    Object.entries(priceMap).map(([symbol, prices]) => [symbol.toUpperCase(), prices.slice()])
  );
  const indices = new Map();

  return async function getNextPrice(symbol) {
    const upper = symbol.toUpperCase();
    const prices = normalized.get(upper);
    if (!prices || prices.length === 0) {
      throw new Error(`No price data for symbol ${symbol}`);
    }

    const index = indices.get(upper) ?? 0;
    const price = prices[index % prices.length];
    indices.set(upper, index + 1);
    return price;
  };
}

/**
 * Determine if the supplied price satisfies the alert configuration.
 * @param {number} price
 * @param {{ direction: 'above' | 'below', targetPrice: number }} config
 */
export function priceMeetsThreshold(price, config) {
  if (config.direction === 'above') {
    return price >= config.targetPrice;
  }

  return price <= config.targetPrice;
}

/**
 * Format a human readable notification message.
 * @param {{ symbol: string, direction: 'above' | 'below', targetPrice: number, price: number }} details
 */
export function formatAlertMessage(details) {
  const directionText = details.direction === 'above' ? 'at or above' : 'at or below';
  return `\uD83D\uDCC8 Alert: ${details.symbol.toUpperCase()} is ${details.price.toFixed(2)} (${directionText} ${details.targetPrice.toFixed(2)})`;
}

function wait(ms, signal, onEvent) {
  if (signal?.aborted) {
    return Promise.resolve();
  }

  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', handleAbort);
    };

    const handleAbort = () => {
      cleanup();
      onEvent?.({ type: 'aborted' });
      resolve();
    };

    if (signal) {
      signal.addEventListener('abort', handleAbort, { once: true });
    }
  });
}

/**
 * Monitor a symbol and emit lifecycle events while polling price data.
 *
 * @param {{
 *  config: { symbol: string, direction: 'above' | 'below', targetPrice: number },
 *  getNextPrice: (symbol: string) => Promise<number>,
 *  intervalMs?: number,
 *  maxChecks?: number,
 *  signal?: AbortSignal,
 *  onEvent?: (event: Record<string, unknown>) => void
 * }} options
 */
export async function monitorPrices(options) {
  const {
    config,
    getNextPrice,
    intervalMs = DEFAULT_INTERVAL_MS,
    maxChecks = DEFAULT_MAX_CHECKS,
    signal,
    onEvent,
  } = options;

  if (!config?.symbol) {
    throw new Error('config.symbol is required');
  }

  if (!config?.direction) {
    throw new Error('config.direction is required');
  }

  if (typeof config?.targetPrice !== 'number' || Number.isNaN(config.targetPrice)) {
    throw new Error('config.targetPrice must be a number');
  }

  if (typeof getNextPrice !== 'function') {
    throw new Error('getNextPrice must be provided');
  }

  const upperSymbol = config.symbol.toUpperCase();

  for (let attempt = 1; attempt <= maxChecks; attempt += 1) {
    if (signal?.aborted) {
      onEvent?.({ type: 'aborted', attempt });
      return { status: 'aborted', attempts: attempt - 1 };
    }

    const price = await getNextPrice(upperSymbol);
    const meets = priceMeetsThreshold(price, config);

    onEvent?.({ type: 'check', attempt, price, meets });

    if (meets) {
      const message = formatAlertMessage({
        symbol: upperSymbol,
        direction: config.direction,
        targetPrice: config.targetPrice,
        price,
      });

      onEvent?.({ type: 'trigger', attempt, price, message });
      return { status: 'triggered', attempts: attempt, price, message };
    }

    if (attempt < maxChecks) {
      onEvent?.({ type: 'waiting', intervalMs });
      await wait(intervalMs, signal, onEvent);
    }
  }

  const timeoutMessage = `\u2139\uFE0F Alert window ended for ${upperSymbol} without triggering.`;
  onEvent?.({ type: 'timeout', message: timeoutMessage });
  return { status: 'timeout', attempts: maxChecks, message: timeoutMessage };
}
