import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockPriceSource,
  formatAlertMessage,
  monitorPrices,
  priceMeetsThreshold,
} from '../src/stock-alert-service.js';
import { DEFAULT_INTERVAL_MS, DEFAULT_MAX_CHECKS } from '../src/config.js';

describe('priceMeetsThreshold', () => {
  it('returns true when price crosses above the target', () => {
    assert.equal(priceMeetsThreshold(105, { direction: 'above', targetPrice: 100 }), true);
    assert.equal(priceMeetsThreshold(95, { direction: 'above', targetPrice: 100 }), false);
  });

  it('returns true when price crosses below the target', () => {
    assert.equal(priceMeetsThreshold(95, { direction: 'below', targetPrice: 100 }), true);
    assert.equal(priceMeetsThreshold(105, { direction: 'below', targetPrice: 100 }), false);
  });
});

describe('formatAlertMessage', () => {
  it('includes the symbol, direction and price', () => {
    const message = formatAlertMessage(
      {
        symbol: 'aapl',
        direction: 'above',
        targetPrice: 190.12,
        price: 191.42,
      },
      { lowestPrice: 185.12, highestPrice: 191.42 }
    );
    assert.match(message, /AAPL/);
    assert.match(message, /191.42/);
    assert.match(message, /190.12/);
    assert.match(message, /Range: 185.12-191.42/);
  });

  it('omits range details when stats are unavailable', () => {
    const message = formatAlertMessage({
      symbol: 'aapl',
      direction: 'above',
      targetPrice: 190.12,
      price: 191.42,
    });

    assert.doesNotMatch(message, /Range:/);
  });
});

describe('createMockPriceSource', () => {
  it('cycles through prices for the requested symbol', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [10, 11, 12] });
    assert.equal(await getNextPrice('AAPL'), 10);
    assert.equal(await getNextPrice('aapl'), 11);
    assert.equal(await getNextPrice('AAPL'), 12);
    assert.equal(await getNextPrice('AAPL'), 10);
  });

  it('throws when symbol is unknown', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [10] });
    await assert.rejects(() => getNextPrice('MSFT'), /No price data/);
  });
});

describe('monitorPrices', () => {
  it('resolves when the threshold is met', async () => {
    const events = [];
    const getNextPrice = createMockPriceSource({ AAPL: [188, 192] });
    const result = await monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 190 },
      getNextPrice,
      intervalMs: 0,
      maxChecks: 5,
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.status, 'triggered');
    const trigger = events.find((event) => event.type === 'trigger');
    assert.ok(trigger);
    assert.equal(trigger.price, 192);
    assert.deepEqual(result.stats, { highestPrice: 192, lowestPrice: 188 });
    assert.deepEqual(trigger.stats, { highestPrice: 192, lowestPrice: 188 });
  });

  it('returns timeout when the price never triggers', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [150, 151, 152] });
    const events = [];
    const result = await monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 200 },
      getNextPrice,
      intervalMs: 0,
      maxChecks: 3,
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.status, 'timeout');
    assert.equal(result.attempts, 3);
    assert.deepEqual(result.stats, { highestPrice: 152, lowestPrice: 150 });
    const timeoutEvent = events.find((event) => event.type === 'timeout');
    assert.match(timeoutEvent.message, /Range observed: 150.00-152.00/);
    assert.deepEqual(timeoutEvent.stats, { highestPrice: 152, lowestPrice: 150 });
  });

  it('stops when aborted between checks', async () => {
    const controller = new AbortController();
    const events = [];
    let calls = 0;
    const getNextPrice = async () => {
      calls += 1;
      if (calls === 1) {
        return 150;
      }
      return 160;
    };

    const monitorPromise = monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 200 },
      getNextPrice,
      intervalMs: 50,
      maxChecks: 5,
      signal: controller.signal,
      onEvent: (event) => events.push(event),
    });

    setTimeout(() => controller.abort(), 10);
    const result = await monitorPromise;
    assert.equal(result.status, 'aborted');
    assert.ok(events.some((event) => event.type === 'aborted'));
    assert.deepEqual(result.stats, { highestPrice: 150, lowestPrice: 150 });
    const checkEvent = events.find((event) => event.type === 'check');
    assert.deepEqual(checkEvent.stats, { highestPrice: 150, lowestPrice: 150 });
  });

  it('uses config defaults when interval and maxChecks are omitted', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [150, 151, 152, 153, 154, 155] });
    const controller = new AbortController();
    const events = [];

    const result = await monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 999 },
      getNextPrice,
      signal: controller.signal,
      onEvent: (event) => {
        events.push(event);
        if (event.type === 'waiting') {
          controller.abort();
        }
      },
    });

    assert.equal(result.status, 'aborted');
    const waitingEvent = events.find((event) => event.type === 'waiting');
    assert.ok(waitingEvent);
    assert.equal(waitingEvent.intervalMs, DEFAULT_INTERVAL_MS);
    const checkEvents = events.filter((event) => event.type === 'check');
    assert.equal(checkEvents.length, 1);
    assert.deepEqual(result.stats, { highestPrice: 150, lowestPrice: 150 });
    assert.deepEqual(checkEvents[0].stats, { highestPrice: 150, lowestPrice: 150 });
  });

  it('honors the default maxChecks when not provided', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [1, 1, 1, 1, 1, 1] });
    const result = await monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 999 },
      getNextPrice,
      intervalMs: 0,
    });

    assert.equal(result.status, 'timeout');
    assert.equal(result.attempts, DEFAULT_MAX_CHECKS);
    assert.deepEqual(result.stats, { highestPrice: 1, lowestPrice: 1 });
  });
});
