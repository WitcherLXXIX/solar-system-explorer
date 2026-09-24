import { describe, expect, it } from 'vitest';
import { SMALL_BODY_LABEL_RANGE_M, smallBodyLabelVisible } from '../../src/render/orbitFade';
import { AU_M } from '../../src/units';

describe('smallBodyLabelVisible', () => {
  it('shows a named small body\'s label only near it (within 5 AU), so the system view is not cluttered', () => {
    expect(SMALL_BODY_LABEL_RANGE_M).toBe(5 * AU_M);
    expect(smallBodyLabelVisible(1e6)).toBe(true); // flying next to it
    expect(smallBodyLabelVisible(4.9 * AU_M)).toBe(true);
    expect(smallBodyLabelVisible(5.1 * AU_M)).toBe(false);
    expect(smallBodyLabelVisible(1.2e13)).toBe(false); // the old phase-3 full-system (Kuiper-scale) view
  });
});
