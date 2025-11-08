import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockPriceSource,
  formatAlertMessage,
  monitorPrices,
  priceMeetsThreshold,
} from '../src/stock-alert-service.js';

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
    const message = formatAlertMessage({
      symbol: 'aapl',
      direction: 'above',
      targetPrice: 190.12,
      price: 191.42,
    });
    assert.match(message, /AAPL/);
    assert.match(message, /191.42/);
    assert.match(message, /190.12/);
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
  });

  it('returns timeout when the price never triggers', async () => {
    const getNextPrice = createMockPriceSource({ AAPL: [150, 151, 152] });
    const result = await monitorPrices({
      config: { symbol: 'AAPL', direction: 'above', targetPrice: 200 },
      getNextPrice,
      intervalMs: 0,
      maxChecks: 3,
    });

    assert.equal(result.status, 'timeout');
    assert.equal(result.attempts, 3);
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
  });
});
