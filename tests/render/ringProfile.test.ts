import { describe, expect, it } from 'vitest';
import type { RingSpec } from '../../src/catalog/bodies';
import { RING_PROFILE_SAMPLES, buildRingProfile } from '../../src/render/ringProfile';

const spec = (bands: RingSpec['bands']): RingSpec => ({ innerM: 1_000_000, outerM: 2_000_000, tint: '#888888', bands });

describe('buildRingProfile', () => {
  it('uses 2048 samples by default', () => {
    expect(RING_PROFILE_SAMPLES).toBe(2048);
    expect(buildRingProfile(spec([])).length).toBe(2048);
  });
  it('is all zero with no bands', () => {
    expect(buildRingProfile(spec([]), 50).every((v) => v === 0)).toBe(true);
  });
  it('fills a wide band with its opacity (10 km per sample here)', () => {
    const p = buildRingProfile(spec([{ centerKm: 1500, widthKm: 100, opacity: 0.4 }]), 100);
    for (let i = 45; i <= 54; i++) expect(p[i]).toBeCloseTo(0.4, 6);
    expect(p[44]).toBe(0);
    expect(p[55]).toBe(0);
  });
  it('gives a band narrower than a sample the covered fraction of its opacity', () => {
    const p = buildRingProfile(spec([{ centerKm: 1105, widthKm: 1, opacity: 0.5 }]), 100);
    expect(p[10]).toBeCloseTo(0.05, 6);
    expect(p[9]).toBe(0);
    expect(p[11]).toBe(0);
  });
  it('takes the maximum where bands overlap', () => {
    const p = buildRingProfile(
      spec([{ centerKm: 1500, widthKm: 100, opacity: 0.2 }, { centerKm: 1500, widthKm: 40, opacity: 0.6 }]), 100);
    expect(p[50]).toBeCloseTo(0.6, 6);
    expect(p[46]).toBeCloseTo(0.2, 6);
  });
  it('clips bands at the ring edges without going out of range', () => {
    const p = buildRingProfile(spec([{ centerKm: 1000, widthKm: 40, opacity: 0.3 }]), 100);
    expect(p[0]).toBeCloseTo(0.3, 6);
    expect(p[1]).toBeCloseTo(0.3, 6);
    expect(p[2]).toBeCloseTo(0.0, 6);
    expect(p.length).toBe(100);
  });
});
