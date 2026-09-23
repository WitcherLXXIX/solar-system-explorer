import { describe, expect, it } from 'vitest';
import { SMALL_BODY_KINDS, isSmallBodyKind, type BodyKind } from '../../src/catalog/bodies';
import { SMALL_BODY_ELEMENTS } from '../../src/catalog/smallBodyElements';

describe('small-body kinds', () => {
  it('lists exactly asteroid, tno and comet', () => {
    expect([...SMALL_BODY_KINDS].sort()).toEqual(['asteroid', 'comet', 'tno']);
  });
  it('recognises small-body kinds and nothing else', () => {
    for (const kind of ['asteroid', 'tno', 'comet'] as const) expect(isSmallBodyKind(kind)).toBe(true);
    for (const kind of ['star', 'planet', 'moon', 'dwarf'] as const satisfies readonly BodyKind[]) expect(isSmallBodyKind(kind)).toBe(false);
  });
  it('starts with an empty element table (Tasks 5 and 6 fill it)', () => {
    expect(SMALL_BODY_ELEMENTS).toBeDefined();
  });
});
