// Downloads every texture the catalog references from Solar System Scope (CC BY 4.0) into public/textures.
// The file list comes straight from the TypeScript catalog (Node strips the types), so it cannot drift.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { allTextureFiles } from '../src/catalog/textureFiles.ts';

const DIR = new URL('../public/textures/', import.meta.url);
await mkdir(DIR, { recursive: true });

const MAGIC = { jpg: [0xff, 0xd8], png: [0x89, 0x50] };
const MIN_BYTES = { jpg: 20_000, png: 2_000 };

let totalBytes = 0;
for (const file of allTextureFiles()) {
  const ext = file.endsWith('.png') ? 'png' : 'jpg';
  const target = new URL(file, DIR);
  const existing = await stat(target).then((s) => s.size, () => null);
  if (existing !== null) {
    totalBytes += existing;
    console.log(`have  ${file}`);
    continue;
  }
  // The site serves an HTML page unless a browser-like user agent is sent.
  const res = await fetch(`https://www.solarsystemscope.com/textures/download/${file}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const [m0, m1] = MAGIC[ext];
  if (!res.ok || bytes[0] !== m0 || bytes[1] !== m1 || bytes.length < MIN_BYTES[ext]) {
    throw new Error(`${file}: expected a ${ext.toUpperCase()}, got status ${res.status}, ${bytes.length} bytes`);
  }
  await writeFile(target, bytes);
  totalBytes += bytes.length;
  console.log(`got   ${file} (${Math.round(bytes.length / 1024)} KB)`);
}
console.log(`total ${Math.round(totalBytes / 1024 / 1024)} MB in public/textures`);
