export interface Notifier {
  notify(message: string): Promise<void>;
}

export class ConsoleNotifier implements Notifier {
  constructor(private readonly logger: (message: string) => void = console.log) {}

  async notify(message: string): Promise<void> {
    this.logger(message);
  }
}
