export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

/** One map at two resolutions: `lo` (2K, always resident) and an optional `hi` (8K, loaded only for nearby bodies). */
export interface MapSlot {
  lo: string;
  hi?: string;
}

/**
 * Atmosphere shell parameters. These numbers are tuned for appearance (a soft limb glow that does not wash out the
 * disc), not measured physical values: scale heights are several times the real ones and coefficients are hand-balanced.
 */
export interface AtmosphereSpec {
  /** Shell top as a fraction of the body radius. */
  heightFraction: number;
  /** Rayleigh and Mie density e-folding heights as fractions of the radius. */
  scaleHeightFraction: number;
  mieScaleHeightFraction: number;
  /** Rayleigh scattering coefficient at the surface, RGB, per body radius. */
  rayleigh: readonly [number, number, number];
  /** Mie scattering coefficient at the surface (per body radius) and its phase asymmetry. */
  mie: number;
  mieG: number;
  /** Sun brightness multiplier, and a final colour tint (linear RGB). */
  intensity: number;
  tint: readonly [number, number, number];
}

export interface RingBand {
  centerKm: number;
  widthKm: number;
  opacity: number;
}

export interface RingSpec {
  /** Radii from the planet's centre, in metres. */
  innerM: number;
  outerM: number;
  /** File stems in public/textures (.png): an RGBA strip whose x axis runs radially, inner to outer, in two resolutions. */
  alphaMap?: MapSlot;
  /** Procedural bands, used when `alphaMap` is absent. */
  bands?: readonly RingBand[];
  /** Colour for procedural rings (CSS hex). */
  tint: string;
}

/** Sun glint on water: Blinn-Phong scaled by Fresnel reflectance (2% looking down, 100% at grazing), so `strength` is high. */
export interface OceanGlint {
  strength: number;
  shininess: number;
}

export interface BodyData {
  id: BodyId;
  name: string;
  kind: 'star' | 'planet';
  /** Volumetric mean radius. */
  radiusM: number;
  massKg: number;
  /** Sidereal rotation period in hours; negative means retrograde. Info panel only. */
  rotationPeriodH: number;
  /** Obliquity to orbit in degrees (Sun: to the ecliptic). Info panel only. */
  axialTiltDeg: number;
  surfaceGravity: number;
  meanTempK: number;
  tempNote?: string;
  /** File stems in public/textures (without extension). */
  maps: { color: MapSlot; night?: MapSlot; clouds?: MapSlot };
  atmosphere?: AtmosphereSpec;
  rings?: RingSpec;
  oceanGlint?: OceanGlint;
  /** Cloud shell height above the surface as a fraction of the radius; must stay below the camera minimum altitude. */
  cloudShellFraction?: number;
  /** CSS colour used for the flat fallback, sprites and orbit lines. */
  color: string;
  source: string;
}

const PLANET_SOURCE = 'NASA Planetary Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet)';

export const BODIES: readonly BodyData[] = [
  {
    id: 'sun', name: 'Sun', kind: 'star', radiusM: 695_700_000, massKg: 1.9885e30, rotationPeriodH: 609.12,
    axialTiltDeg: 7.25, surfaceGravity: 274.0, meanTempK: 5772, tempNote: 'effective temperature of the photosphere',
    maps: { color: { lo: '2k_sun', hi: '8k_sun' } }, color: '#ffd27a',
    source: 'NASA Sun Fact Sheet; IAU 2015 nominal solar values',
  },
  {
    id: 'mercury', name: 'Mercury', kind: 'planet', radiusM: 2_439_400, massKg: 3.30e23, rotationPeriodH: 1407.6,
    axialTiltDeg: 0.034, surfaceGravity: 3.7, meanTempK: 440.15,
    maps: { color: { lo: '2k_mercury', hi: '8k_mercury' } }, color: '#a8a29e', source: PLANET_SOURCE,
  },
  {
    id: 'venus', name: 'Venus', kind: 'planet', radiusM: 6_051_800, massKg: 4.87e24, rotationPeriodH: -5832.5,
    axialTiltDeg: 177.4, surfaceGravity: 8.9, meanTempK: 737.15,
    // The surface is invisible under the clouds, so the base map is the cloud-top image.
    maps: { color: { lo: '4k_venus_atmosphere' } }, color: '#e3c07a', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.03, scaleHeightFraction: 0.007, mieScaleHeightFraction: 0.007,
      rayleigh: [3, 3, 3], mie: 8, mieG: 0.5, intensity: 14, tint: [1.0, 0.92, 0.66],
    },
  },
  {
    id: 'earth', name: 'Earth', kind: 'planet', radiusM: 6_371_000, massKg: 5.97e24, rotationPeriodH: 23.9345,
    axialTiltDeg: 23.4, surfaceGravity: 9.8, meanTempK: 288.15,
    maps: {
      color: { lo: '2k_earth_daymap', hi: '8k_earth_daymap' },
      night: { lo: '2k_earth_nightmap', hi: '8k_earth_nightmap' },
      clouds: { lo: '2k_earth_clouds', hi: '8k_earth_clouds' },
    },
    oceanGlint: { strength: 5, shininess: 30 },
    cloudShellFraction: 0.0015,
    color: '#4f86d6', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.035, scaleHeightFraction: 0.006, mieScaleHeightFraction: 0.0008,
      rayleigh: [4, 9, 22], mie: 15, mieG: 0.76, intensity: 1.8, tint: [1, 1, 1],
    },
  },
  {
    id: 'mars', name: 'Mars', kind: 'planet', radiusM: 3_389_500, massKg: 6.42e23, rotationPeriodH: 24.6229,
    axialTiltDeg: 25.2, surfaceGravity: 3.7, meanTempK: 208.15,
    maps: { color: { lo: '2k_mars', hi: '8k_mars' } }, color: '#c1440e', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.025, scaleHeightFraction: 0.005, mieScaleHeightFraction: 0.005,
      rayleigh: [1.6, 1.6, 1.6], mie: 6, mieG: 0.6, intensity: 12, tint: [1.0, 0.78, 0.42],
    },
  },
  {
    id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusM: 69_911_000, massKg: 1.898e27, rotationPeriodH: 9.925,
    axialTiltDeg: 3.1, surfaceGravity: 23.1, meanTempK: 163.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_jupiter', hi: '8k_jupiter' } }, color: '#c99b6d', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.008, mieScaleHeightFraction: 0.006,
      rayleigh: [1.9, 2.0, 2.3], mie: 0.5, mieG: 0.5, intensity: 2.2, tint: [1.0, 0.9, 0.7],
    },
    // Procedural band opacities for Jupiter's rings are exaggerated for visibility (its real rings are far fainter
    // still); real optical depths are lower. They also feed the ring-shadow term on the planet (strength 0.9), so the
    // shadow is exaggerated to match.
    rings: {
      innerM: 92_000_000, outerM: 226_000_000, tint: '#8a7f73',
      bands: [
        { centerKm: 107_250, widthKm: 30_500, opacity: 0.02 }, // halo, 92,000-122,500 km
        { centerKm: 125_750, widthKm: 6_500, opacity: 0.08 }, // main ring, 122,500-129,000 km
        { centerKm: 155_500, widthKm: 53_000, opacity: 0.01 }, // Amalthea gossamer, 129,000-182,000 km
        { centerKm: 177_500, widthKm: 97_000, opacity: 0.005 }, // Thebe gossamer, 129,000-226,000 km
      ],
    },
  },
  {
    id: 'saturn', name: 'Saturn', kind: 'planet', radiusM: 58_232_000, massKg: 5.68e26, rotationPeriodH: 10.656,
    axialTiltDeg: 26.7, surfaceGravity: 9.0, meanTempK: 133.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_saturn', hi: '8k_saturn' } }, color: '#e0c98f', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.008, mieScaleHeightFraction: 0.006,
      rayleigh: [1.8, 1.9, 2.2], mie: 0.5, mieG: 0.5, intensity: 2.4, tint: [1.0, 0.93, 0.72],
    },
    // D ring inner edge to F ring: the alpha strip spans exactly this range (Cassini Division at 71% of the width).
    rings: { innerM: 66_900_000, outerM: 140_220_000, alphaMap: { lo: '2k_saturn_ring_alpha', hi: '8k_saturn_ring_alpha' }, tint: '#c9b99a' },
  },
  {
    id: 'uranus', name: 'Uranus', kind: 'planet', radiusM: 25_362_000, massKg: 8.68e25, rotationPeriodH: -17.24,
    axialTiltDeg: 97.8, surfaceGravity: 8.7, meanTempK: 78.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_uranus' } }, color: '#9fd8e0', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.008, mieScaleHeightFraction: 0.006,
      rayleigh: [0.8, 2.0, 2.1], mie: 0.5, mieG: 0.5, intensity: 2.4, tint: [0.6, 1.0, 0.95],
    },
    // Procedural band opacities for Uranus's rings are exaggerated 2-8x for visibility; real optical depths are
    // lower. They also feed the ring-shadow term on the planet (strength 0.9), so the shadow is exaggerated to match.
    rings: {
      innerM: 41_000_000, outerM: 52_000_000, tint: '#a29b92',
      bands: [
        { centerKm: 41_837, widthKm: 1.6, opacity: 0.6 }, // ring 6
        { centerKm: 42_234, widthKm: 1.9, opacity: 0.6 }, // ring 5
        { centerKm: 42_570, widthKm: 2.4, opacity: 0.6 }, // ring 4
        { centerKm: 44_718, widthKm: 7.2, opacity: 0.6 }, // alpha
        { centerKm: 45_661, widthKm: 8.2, opacity: 0.6 }, // beta
        { centerKm: 47_176, widthKm: 1.9, opacity: 0.6 }, // eta
        { centerKm: 47_627, widthKm: 3.6, opacity: 0.6 }, // gamma
        { centerKm: 48_300, widthKm: 6.6, opacity: 0.6 }, // delta
        { centerKm: 50_024, widthKm: 2.0, opacity: 0.6 }, // lambda
        { centerKm: 51_149, widthKm: 58, opacity: 0.9 }, // epsilon
      ],
    },
  },
  {
    id: 'neptune', name: 'Neptune', kind: 'planet', radiusM: 24_622_000, massKg: 1.02e26, rotationPeriodH: 16.11,
    axialTiltDeg: 28.3, surfaceGravity: 11.0, meanTempK: 73.15, tempNote: 'at the 1 bar level',
    maps: { color: { lo: '2k_neptune' } }, color: '#4a6fe0', source: PLANET_SOURCE,
    atmosphere: {
      heightFraction: 0.02, scaleHeightFraction: 0.008, mieScaleHeightFraction: 0.006,
      rayleigh: [0.5, 1.5, 2.8], mie: 0.5, mieG: 0.5, intensity: 3.0, tint: [0.45, 0.7, 1.0],
    },
    // Procedural band opacities for Neptune's rings are exaggerated 2-8x for visibility; real optical depths are
    // lower. They also feed the ring-shadow term on the planet (strength 0.9), so the shadow is exaggerated to match.
    rings: {
      innerM: 40_000_000, outerM: 64_000_000, tint: '#9a9791',
      bands: [
        { centerKm: 41_900, widthKm: 2_000, opacity: 0.05 }, // Galle
        { centerKm: 53_200, widthKm: 113, opacity: 0.3 }, // Le Verrier
        { centerKm: 55_200, widthKm: 4_000, opacity: 0.03 }, // Lassell/Arago plateau, 53,200-57,200 km
        { centerKm: 57_200, widthKm: 100, opacity: 0.2 }, // Arago
        { centerKm: 62_933, widthKm: 35, opacity: 0.4 }, // Adams
      ],
    },
  },
];

export const BODY_IDS: readonly BodyId[] = BODIES.map((b) => b.id);

const BY_ID = new Map<BodyId, BodyData>(BODIES.map((b) => [b.id, b]));

export function getBody(id: BodyId): BodyData {
  const body = BY_ID.get(id);
  if (!body) throw new Error(`unknown body: ${id}`);
  return body;
}
