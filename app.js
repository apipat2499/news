import { createMockPriceSource, monitorPrices } from './src/stock-alert-service.js';

const form = document.querySelector('#alert-form');
const logList = document.querySelector('#log');
const statusBadge = document.querySelector('#status');
const stopButton = document.querySelector('#stop-monitoring');
const symbolSelect = document.querySelector('#symbol');
const priceDisplay = document.querySelector('#latest-price');

let controller = null;
let getNextPrice = null;
let activeRun = null;

function appendLog(message) {
  const entry = document.createElement('li');
  entry.textContent = message;
  logList.prepend(entry);
}

function setStatus(text, variant = 'idle') {
  statusBadge.textContent = text;
  statusBadge.dataset.variant = variant;
}

function setFormDisabled(disabled) {
  form.querySelectorAll('input, select, button').forEach((el) => {
    if (el.id !== 'stop-monitoring') {
      el.disabled = disabled;
    }
  });
}

function resetController() {
  controller = null;
  activeRun = null;
  setFormDisabled(false);
  stopButton.disabled = true;
}

async function loadPriceData() {
  const response = await fetch('./assets/mock-prices.json');
  if (!response.ok) {
    throw new Error('Unable to load price data');
  }

  const data = await response.json();
  getNextPrice = createMockPriceSource(data);

  const symbols = Object.keys(data).sort();
  for (const symbol of symbols) {
    const option = document.createElement('option');
    option.value = symbol;
    option.textContent = symbol;
    symbolSelect.append(option);
  }
}

function handleEvent(event) {
  switch (event.type) {
    case 'check': {
      priceDisplay.textContent = event.price.toFixed(2);
      appendLog(`Checked ${form.symbol.value.toUpperCase()}: ${event.price.toFixed(2)} (${event.meets ? 'meets' : 'no match'})`);
      break;
    }
    case 'waiting': {
      appendLog(`Waiting ${Math.round(event.intervalMs / 1000)}s before next check...`);
      break;
    }
    case 'trigger': {
      appendLog(event.message);
      break;
    }
    case 'timeout': {
      appendLog(event.message);
      break;
    }
    case 'aborted': {
      appendLog('Monitoring cancelled.');
      setStatus('Cancelled', 'neutral');
      resetController();
      break;
    }
    default:
      break;
  }
}

function stopMonitoring() {
  if (controller) {
    controller.abort();
  }
  resetController();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!getNextPrice) {
    appendLog('Price data not ready yet.');
    return;
  }

  stopMonitoring();

  const symbol = form.symbol.value.trim();
  const direction = form.direction.value;
  const targetPrice = Number.parseFloat(form.targetPrice.value);
  const intervalMs = Number.parseInt(form.intervalMs.value, 10);
  const maxChecks = Number.parseInt(form.maxChecks.value, 10);

  if (!symbol || Number.isNaN(targetPrice)) {
    appendLog('Please provide a symbol and target price.');
    return;
  }

  controller = new AbortController();

  setFormDisabled(true);
  stopButton.disabled = false;

  logList.innerHTML = '';
  setStatus('Watching…', 'pending');

  const runToken = Symbol('run');
  activeRun = runToken;

  const result = await monitorPrices({
    config: { symbol, direction, targetPrice },
    getNextPrice,
    intervalMs,
    maxChecks,
    signal: controller.signal,
    onEvent: (event) => {
      if (activeRun !== runToken) {
        return;
      }
      handleEvent(event);
    },
  });

  if (activeRun !== runToken) {
    return;
  }

  switch (result.status) {
    case 'triggered':
      setStatus('Triggered', 'success');
      resetController();
      break;
    case 'timeout':
      setStatus('Completed', 'info');
      resetController();
      break;
    case 'aborted':
      // Already handled inside handleEvent.
      break;
    default:
      setStatus('Idle', 'idle');
      resetController();
  }
});

stopButton.addEventListener('click', () => {
  appendLog('Stop requested.');
  setStatus('Cancelled', 'neutral');
  stopMonitoring();
});

loadPriceData()
  .then(() => {
    setStatus('Ready', 'info');
  })
  .catch((error) => {
    console.error(error);
    appendLog('Failed to load price data. See console for details.');
    setStatus('Error', 'error');
  });
