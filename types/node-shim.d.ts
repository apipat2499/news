declare module 'fs' {
  export function readFileSync(path: string, options: 'utf-8'): string;
}

declare module 'path' {
  export function resolve(...paths: string[]): string;
}

declare module 'url' {
  export function fileURLToPath(path: string | URL): string;
  export function pathToFileURL(path: string): URL;
}

declare const process: {
  argv: string[];
  exitCode?: number;
  cwd(): string;
};

declare interface ImportMeta {
  readonly url: string;
}
