import type { AlertConfig, AlertDirection, MonitorOptions } from './types.js';

export type AlertRequestInput = {
  symbol: string;
  target: number;
  direction: AlertDirection;
  interval?: number;
  checks?: number;
};

export interface ValidationIssue {
  field: 'symbol' | 'target' | 'direction' | 'interval' | 'checks';
  message: string;
}

export type ValidationResult =
  | { success: true; data: AlertRequestInput }
  | { success: false; errors: ValidationIssue[] };

function asRecord(payload: unknown): Record<string, unknown> | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }

  return null;
}

function toPositiveInteger(value: unknown, field: ValidationIssue['field']): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const numberValue = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0 || !Number.isInteger(numberValue)) {
    throw {
      field,
      message: `${field} must be a positive integer`
    } satisfies ValidationIssue;
  }

  return numberValue;
}

function toFiniteNumber(value: unknown, field: ValidationIssue['field']): number {
  const numberValue = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(numberValue)) {
    throw {
      field,
      message: `${field} must be a finite number`
    } satisfies ValidationIssue;
  }

  return numberValue;
}

export function validateAlertRequest(payload: unknown): ValidationResult {
  const errors: ValidationIssue[] = [];
  const record = asRecord(payload);

  if (!record) {
    return {
      success: false,
      errors: [{ field: 'symbol', message: 'Request payload must be an object' }]
    };
  }

  const symbolRaw = record.symbol;
  let symbol: string | undefined;
  if (typeof symbolRaw === 'string' && symbolRaw.trim().length > 0) {
    symbol = symbolRaw.trim();
  } else {
    errors.push({ field: 'symbol', message: 'Symbol is required' });
  }

  const targetRaw = record.target ?? record.targetPrice;
  let target: number | undefined;
  if (targetRaw === undefined) {
    errors.push({ field: 'target', message: 'Target price is required' });
  } else {
    try {
      target = toFiniteNumber(targetRaw, 'target');
    } catch (issue) {
      errors.push(issue as ValidationIssue);
    }
  }

  const directionRaw = record.direction;
  let direction: AlertDirection = 'above';
  if (directionRaw !== undefined) {
    if (typeof directionRaw === 'string') {
      const normalized = directionRaw.toLowerCase();
      if (normalized === 'above' || normalized === 'below') {
        direction = normalized;
      } else {
        errors.push({ field: 'direction', message: 'Direction must be "above" or "below"' });
      }
    } else {
      errors.push({ field: 'direction', message: 'Direction must be a string' });
    }
  }

  let interval: number | undefined;
  try {
    interval = toPositiveInteger(record.interval, 'interval');
  } catch (issue) {
    errors.push(issue as ValidationIssue);
  }

  let checks: number | undefined;
  try {
    checks = toPositiveInteger(record.checks, 'checks');
  } catch (issue) {
    errors.push(issue as ValidationIssue);
  }

  if (errors.length > 0 || symbol === undefined || target === undefined) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      symbol,
      target,
      direction,
      interval,
      checks
    }
  };
}

export function parseAlertRequest(payload: unknown): AlertRequestInput {
  const result = validateAlertRequest(payload);
  if (!result.success) {
    const message = result.errors[0]?.message ?? 'Invalid request payload';
    throw new Error(message);
  }

  return result.data;
}

export function buildMonitorConfig(input: AlertRequestInput): {
  alertConfig: AlertConfig;
  monitorOptions: MonitorOptions;
} {
  return {
    alertConfig: {
      symbol: input.symbol,
      targetPrice: input.target,
      direction: input.direction
    },
    monitorOptions: {
      intervalMs: input.interval ?? 2000,
      maxChecks: input.checks ?? 5
    }
  };
}
