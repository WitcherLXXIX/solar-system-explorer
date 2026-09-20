// Downloads the 2K planet textures from Solar System Scope (CC BY 4.0) into public/textures.
import { mkdir, stat, writeFile } from 'node:fs/promises';

const FILES = [
  '2k_sun', '2k_mercury', '2k_venus_surface', '2k_earth_daymap', '2k_mars',
  '2k_jupiter', '2k_saturn', '2k_uranus', '2k_neptune',
];
const DIR = new URL('../public/textures/', import.meta.url);
await mkdir(DIR, { recursive: true });

for (const name of FILES) {
  const target = new URL(`${name}.jpg`, DIR);
  if (await stat(target).then(() => true, () => false)) {
    console.log(`have  ${name}`);
    continue;
  }
  // The site serves an HTML page unless a browser-like user agent is sent.
  const res = await fetch(`https://www.solarsystemscope.com/textures/download/${name}.jpg`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!res.ok || !isJpeg || bytes.length < 20_000) {
    throw new Error(`${name}: expected a JPEG, got status ${res.status}, ${bytes.length} bytes`);
  }
  await writeFile(target, bytes);
  console.log(`got   ${name} (${Math.round(bytes.length / 1024)} KB)`);
}
