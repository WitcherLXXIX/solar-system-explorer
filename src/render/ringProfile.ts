import type { RingSpec } from '../catalog/bodies';

export const RING_PROFILE_SAMPLES = 2048;

/**
 * Opacity per sample across [innerM, outerM] for a procedural ring. Each sample takes the maximum over bands of
 * (band opacity x the fraction of the sample the band covers), so bands narrower than a sample stay present but fainter.
 */
export function buildRingProfile(spec: RingSpec, samples = RING_PROFILE_SAMPLES): Float32Array {
  const out = new Float32Array(samples);
  const innerKm = spec.innerM / 1000;
  const sampleKm = (spec.outerM - spec.innerM) / 1000 / samples;
  for (const band of spec.bands ?? []) {
    const lo = band.centerKm - band.widthKm / 2;
    const hi = band.centerKm + band.widthKm / 2;
    const first = Math.max(0, Math.floor((lo - innerKm) / sampleKm));
    const last = Math.min(samples - 1, Math.floor((hi - innerKm) / sampleKm));
    for (let i = first; i <= last; i++) {
      const s0 = innerKm + i * sampleKm;
      const overlap = Math.min(hi, s0 + sampleKm) - Math.max(lo, s0);
      if (overlap <= 0) continue;
      const a = band.opacity * Math.min(1, overlap / sampleKm);
      if (a > out[i]!) out[i] = a;
    }
  }
  return out;
}
