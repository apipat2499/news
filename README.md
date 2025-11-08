# Stock Price Alert CLI

A simple TypeScript command-line application that simulates monitoring stock prices and emits alerts when configurable thresholds are crossed.

## Getting Started

```bash
pnpm install
pnpm build
```

## Development

Run the CLI directly with:

```bash
pnpm dev -- --symbol AAPL --target 193 --direction above --interval 1000 --checks 7
```

## Testing

```bash
pnpm test
```
