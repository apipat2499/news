import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

let cachedPrices: Record<string, number[]> | null = null;

function isNodeError(error: unknown): error is { code?: string } {
  return Boolean(error) && typeof error === 'object' && 'code' in (error as Record<string, unknown>);
}

function readPriceFile(filePath: string): Record<string, number[]> | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content) as Record<string, number[]>;
    cachedPrices = parsed;
    return parsed;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export function loadMockPrices(): Record<string, number[]> {
  if (cachedPrices) {
    return cachedPrices;
  }

  const workingDirectoryPath = resolve(process.cwd(), 'public/assets/mock-prices.json');
  const fallbackPath = fileURLToPath(new URL('../../public/assets/mock-prices.json', import.meta.url));

  const sources = [workingDirectoryPath, fallbackPath];
  let lastError: unknown;

  for (const filePath of sources) {
    try {
      const result = readPriceFile(filePath);
      if (result) {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Unable to load mock price data: ${lastError.message}`);
  }

  throw new Error('Unable to load mock price data from any known location');
}
