// Minimal hand-written types for the Node.js APIs used in tests, since @types/node is not installed.
// Delete this file (and tests/tsconfig.json's "node" entry in "types") if @types/node is ever added.
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
