// Downloads every texture the catalog references into public/textures: Solar System Scope files (CC BY 4.0) by default,
// and the NASA/USGS/JPL maps listed in src/catalog/textureSources.ts from their own hosts. Only hosts on the allow-list
// are contacted. The file list comes straight from the TypeScript catalog (Node strips the types), so it cannot drift.
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { allTextureFiles } from '../src/catalog/textureFiles.ts';
import { imageSize, isGlobalMapShape } from '../src/catalog/imageSize.ts';
import { TEXTURE_SOURCES, isAllowedHost } from '../src/catalog/textureSources.ts';

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
  const source = TEXTURE_SOURCES[file];
  // Solar System Scope serves an HTML page unless a browser-like user agent is sent.
  const url = source ? source.url : `https://www.solarsystemscope.com/textures/download/${file}`;
  if (!isAllowedHost(url)) throw new Error(`${file}: ${url} is not on the allowed host list`);
  const [m0, m1] = MAGIC[ext];
  // Hosts sometimes answer a CI runner with a 2xx-but-not-an-image challenge page; retry with backoff before failing.
  let res, bytes;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    bytes = new Uint8Array(await res.arrayBuffer());
    if (res.ok && bytes[0] === m0 && bytes[1] === m1 && bytes.length >= MIN_BYTES[ext]) break;
    if (attempt === 4) {
      throw new Error(`${file}: expected a ${ext.toUpperCase()}, got status ${res.status}, ${bytes.length} bytes (after ${attempt} attempts)`);
    }
    console.log(`retry ${file}: status ${res.status}, ${bytes.length} bytes (attempt ${attempt})`);
    await new Promise((r) => setTimeout(r, attempt * 10_000));
  }
  if (source) {
    const size = imageSize(bytes);
    if (!size || !isGlobalMapShape(size) || size.width > 4096 || size.width < 1024) {
      throw new Error(`${file}: ${size ? `${size.width}x${size.height}` : 'unreadable image'} is not a 1024-4096 px wide 2:1 map`);
    }
  }
  await writeFile(target, bytes);
  totalBytes += bytes.length;
  console.log(`got   ${file} (${Math.round(bytes.length / 1024)} KB)${source ? ` from ${new URL(url).hostname}` : ''}`);
}
console.log(`total ${Math.round(totalBytes / 1024 / 1024)} MB in public/textures`);
