/** Where a non-Solar-System-Scope map comes from. The download script reads this table; the README credits it. */
export interface TextureSource {
  url: string;
  credit: string;
  licence: string;
}

/** The only hosts the project contacts for images (the Node download script refuses everything else). */
export const ALLOWED_TEXTURE_HOSTS: readonly string[] = [
  'www.solarsystemscope.com', 'photojournal.jpl.nasa.gov', 'astrogeology.usgs.gov', 'planetarymaps.usgs.gov',
  'pds-imaging.jpl.nasa.gov', 'science.nasa.gov', 'ssd.jpl.nasa.gov',
];

export function isAllowedHost(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ALLOWED_TEXTURE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

/** File name (with .jpg) to source. Files that are not listed here come from Solar System Scope (CC BY 4.0). */
export const TEXTURE_SOURCES: Readonly<Record<string, TextureSource>> = {
  '2k_ceres.jpg': {
    url: 'https://astrogeology.usgs.gov/ckan/dataset/39338f6b-5fef-4ac4-9310-ce5b1cdd0f69/resource/8b1e5592-c2b0-4ed7-8cd2-5a3590d88bf7/download/ceres_dawn_fc_dlr_global_1024.jpg',
    credit: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA (Dawn Framing Camera global mosaic, 400 m/pixel)',
    licence: 'USGS Astrogeology Science Center product page: Access Constraints "public domain", Use Constraints "Please cite authors".',
  },
};
