// Type definitions for Node.js modules used in tests
declare module 'node:fs' {
  export function readFileSync(path: string | Buffer | number, options?: { encoding?: string } | string): string | Buffer;
  export function readFileSync(path: string | Buffer | number, encoding?: string): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}