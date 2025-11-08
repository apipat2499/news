# Stock Alert Monitor

A lightweight browser-based dashboard for rehearsing stock price alerts. The app streams deterministic
mock data so you can explore different alert directions, thresholds, and polling windows without
dependency installs or API keys.

## Getting Started

1. **Run the static server**
   ```bash
   npm run serve
   ```
   This launches a zero-dependency Node server on [http://localhost:3000](http://localhost:3000).

2. **Open the dashboard**
   Visit the URL above in your browser. Choose a stock symbol, direction, and target price, then start
the monitor to watch alerts flow into the activity log. Use the **Stop** button to cancel early.

## Testing

Unit tests rely on Node's built-in `node:test` runner, so no packages are required:

```bash
npm test
```

## Project Structure

```
├── app.js                 # Browser entry point that wires up the alert form and log
├── assets/                # Deterministic mock price histories used by the UI
│   └── mock-prices.json
├── scripts/serve.js       # Minimal static file server for local development
├── src/stock-alert-service.js
│                         # Shared alert logic for both the UI and tests
├── styles.css             # Gradient-heavy styling for the dashboard
└── tests/stock-alert-service.test.mjs
                          # Coverage for thresholding, mock price rotation, and monitoring flow
```

## Mock Data

The bundled price sequences loop when exhausted so alerts continue firing during long sessions.
Feel free to extend `assets/mock-prices.json` with additional tickers or alternative price
trajectories to test bearish and bullish scenarios alike.
