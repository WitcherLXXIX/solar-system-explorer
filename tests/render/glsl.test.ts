import { describe, expect, it } from 'vitest';
import { glslFloat } from '../../src/render/glsl';

describe('glslFloat', () => {
  it('turns integers into float literals', () => {
    expect(glslFloat(5)).toBe('5.0');
    expect(glslFloat(0)).toBe('0.0');
    expect(glslFloat(-2)).toBe('-2.0');
  });
  it('leaves fractions alone', () => {
    expect(glslFloat(0.85)).toBe('0.85');
    expect(glslFloat(-0.08)).toBe('-0.08');
  });
  it('passes exponent forms through and rejects non-finite values', () => {
    expect(glslFloat(1e-7)).toBe('1e-7');
    expect(() => glslFloat(Number.NaN)).toThrow();
    expect(() => glslFloat(Infinity)).toThrow();
  });
});
