import type { BodyId } from './bodies';
import type { ElementSet } from './orbits';

/**
 * JPL Small-Body Database osculating elements (ecliptic J2000, two-body motion from the element epoch, no precession) of the
 * twelve named asteroids, trans-Neptunian objects and comets. Kept apart from `ELEMENTS` (the satellite mean elements) so
 * that table's tests are untouched; `elementRelative` falls back to this one. Tasks 5 and 6 fill it.
 */
export const SMALL_BODY_ELEMENTS: Partial<Record<BodyId, ElementSet>> = {};
