export type AlertDirection = 'above' | 'below';

export interface AlertConfig {
  symbol: string;
  targetPrice: number;
  direction: AlertDirection;
}

export interface MonitorOptions {
  intervalMs?: number;
  maxChecks?: number;
}
