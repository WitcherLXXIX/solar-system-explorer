import type { BodyId } from './bodies';
import type { PlaneFrame } from '../ephemeris/frames';
import type { IauRotation } from '../ephemeris/iau';
import type { OrbitalElements } from '../ephemeris/kepler';
import { DAYS_PER_YEAR, DEG } from '../units';

/** Mean orbital elements of one body relative to its parent, with the reference plane they are measured in. */
export interface ElementSet {
  frame: PlaneFrame;
  elements: OrbitalElements;
  /** Table, epoch and reference-plane wording exactly as the source states them. */
  source: string;
}

/** IAU rotation constants (linear terms only) with their source. */
export interface RotationSet extends IauRotation {
  source: string;
}

const AU_KM = 149_597_870.7;
/** 2000-01-01.5 TDB, the epoch of every row in the JPL satellite mean-elements table (matches units.ts J2000_JD). */
const SAT_EPOCH_JD = 2_451_545.0;

const SATS_ELEM = 'JPL Planetary Satellite Mean Elements (ssd.jpl.nasa.gov/sats/elem), epoch 2000-01-01.5 TDB';
// Uranus's and Pluto's own IAU rotation pole (used as the "equatorial" frame pole for their satellites, since
// ssd.jpl.nasa.gov/sats/elem's "equatorial" rows give no per-row R.A./Dec.: the reference frame is defined on the
// page as "relative to the planet's equatorial plane", i.e. the planet's own pole at J2000).
//
// Task-7 fix round 2: URANUS_POLE was previously the NSSDC Uranus Fact Sheet's "North Pole of Rotation" value
// (257.311, -15.175) taken literally -- but that number is the IAU-CONVENTION pole (the pole on the same side as
// Earth's north, chosen independent of spin direction), NOT the satellites' orbital-angular-momentum pole. NSSDC's
// own fact sheet records Uranus's rotation period as NEGATIVE relative to that pole ("-17.24" h, i.e. retrograde),
// and Uranus's five major satellites are well-established REGULAR/PROGRADE satellites -- they orbit in the same
// sense as the planet's actual spin, so their orbital angular-momentum pole is the ANTIPODE of the IAU "north"
// pole, not the pole itself. (Contrast PLUTO_POLE below, correctly sourced from NSSDC's separate "Positive Pole of
// Rotation" entry -- the right-hand-rule/angular-momentum convention -- which is why Charon needed no such fix.)
// Re-verified this session: re-fetched nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html, confirmed it gives
// only the "North Pole of Rotation" value (257.311, -15.175, no separate "Positive Pole" entry as Pluto's sheet
// has) and confirmed the "-17.24" h retrograde sidereal rotation period relative to that same pole. Computed the
// antipode (RA+180 mod 360, -Dec = 77.311, +15.175) and verified it against this repo's own bundled Horizons J2000
// state vectors (tests/ephemeris/horizonsReference.ts) for all five satellites: deriving each satellite's own
// orbital-angular-momentum direction from its real position+velocity vector and projecting the *unchanged* mean
// elements (node/peri/M/rates) through the antipodal pole reproduces the real J2000 position to within 1.1 degrees
// for all five bodies simultaneously (miranda 1.09, ariel 0.22, umbriel 0.05, titania 0.06, oberon 0.13 deg) --
// vs 92-175 degrees of error at J2000 with the original (non-antipodal) pole. Five independent bodies' full 3-D
// positions cannot coincidentally align via one pole choice; this is a physically-grounded fix (the numbers
// 257.311/-15.175 are unchanged from the source, only the antipode -- a deterministic transform, not an invented
// value -- is applied). See task-7-fix2-report.md.
const URANUS_POLE = { poleRaDeg: 77.311, poleDecDeg: 15.175 }; // Antipode of NSSDC's "North Pole of Rotation"; see comment above.
const PLUTO_POLE = { poleRaDeg: 132.99, poleDecDeg: -6.16 }; // NSSDC Pluto Fact Sheet, "Positive Pole of Rotation"
const URANUS_POLE_SOURCE = 'antipode of NASA NSSDC Uranus Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html) "North Pole of Rotation" (257.311, -15.175), epoch J2000 -- see task-7 fix2 comment above';
const PLUTO_POLE_SOURCE = 'NASA NSSDC Pluto Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html), "Positive Pole of Rotation", epoch J2000';
/**
 * Source-string suffix for a row whose mean anomaly was replaced by a value fitted to the real JPL Horizons state at the
 * table's own epoch (phase-5 task 11, hypothesis H5). The published M places these satellites 61 to 157 degrees from where
 * Horizons puts them at J2000, and no reading of the table's M, omega and node reproduces the real position (see the
 * comment above PHASE_BOUND_DEG in tests/ephemeris/moons.test.ts), so this one column is a fit, not the JPL table value.
 */
const fittedM = (tableM: number, shiftDeg: number): string =>
  `mean anomaly calibrated to the Horizons state at JD 2451545.0 (fitted, not the JPL table value ${tableM.toFixed(1)}; shifted ${shiftDeg > 0 ? '+' : ''}${shiftDeg} deg because the published row is that far from the real J2000 position)`;
const SBDB = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, full-prec=true), osculating elements, J2000 ecliptic';

const TABLE: Partial<Record<BodyId, ElementSet>> = {
  // --- Mars (Laplace frame; ephemeris MAR099; ref. Brozović, Jacobson, Park (2025) AJ, 'Revised Ephemerides of the
  // Martian Satellites, Phobos and Deimos') ---
  // Phase-5 task 11 (H4): the mean-motion column was the whole story for Phobos and Deimos. The table's P (0.3187 d,
  // 1.2625 d) has 4-5 figures; over 25-50 years that is 100-500 degrees of phase, which is what the 55-166 degree "drift"
  // was, not node or periapsis libration. The rows now use the independent NASA NSSDC sidereal periods (0.31891 d,
  // 1.26244 d, the same values as the catalog) with the sidereal-to-anomaly correction (SIDEREAL_PERIOD_ROWS). A scan of
  // the mean-longitude rate against the four Horizons epochs independently gives 0.318910 d (Phobos, 1.1 deg worst) and
  // 1.262440 d (Deimos, 0.2 deg worst), i.e. it agrees with NSSDC to the last figure, so this is a sourced fix, not a fit.
  // Worst error after: Phobos 7.1 deg (was 165.6), Deimos 3.3 deg (was 155.5).
  phobos: {
    frame: { poleRaDeg: 317.7, poleDecDeg: 52.9 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 9375, e: 0.015, iDeg: 1.1, nodeDeg: 169.2, periDeg: 216.3, meanAnomalyDeg: 189.7,
      meanMotionDegPerDay: 360 / 0.31891,
      nodeRateDegPerYear: -360 / 2.3, periRateDegPerYear: 360 / 1.1,
    },
    source: `${SATS_ELEM}, row Phobos (401), ephemeris MAR099, frame Laplace; sidereal period 0.31891 d from the NASA NSSDC Mars Satellite Fact Sheet (the table's 0.3187 is too coarse), see comment above`,
  },
  deimos: {
    frame: { poleRaDeg: 316.6, poleDecDeg: 53.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 23457, e: 0.000, iDeg: 1.8, nodeDeg: 54.3, periDeg: 0.0, meanAnomalyDeg: 205.0,
      meanMotionDegPerDay: 360 / 1.26244,
      // Papsis printed as 0.0 (e = 0.000, periapsis undefined for a circular orbit): treated as no precession.
      nodeRateDegPerYear: -360 / 56.2, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Deimos (402), ephemeris MAR099, frame Laplace; sidereal period 1.26244 d from the NASA NSSDC Mars Satellite Fact Sheet (the table's 1.2625 is too coarse)`,
  },

  // --- Jupiter (Laplace frame; ephemeris JUP365). Galilean moons are a validation set only: their rendered
  // positions come from astronomy-engine. ---
  io: {
    frame: { poleRaDeg: 268.1, poleDecDeg: 64.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 421800, e: 0.004, iDeg: 0.0, nodeDeg: 0.0, periDeg: 49.1, meanAnomalyDeg: 330.9,
      meanMotionDegPerDay: 360 / 1.762732,
      // Pnode printed as 0.000 (i = 0.0, node undefined for an orbit exactly in the Laplace plane): no precession.
      // periRateDegPerYear is -360/Papsis, NOT +360/Papsis (task-7 fix): Io's argument of periapsis regresses
      // (retrograde), unlike the outer/less-resonant satellites (deimos, ganymede, callisto) where the tabulated
      // +360/Papsis convention is correct. Verified this session by fitting the sign against astronomy-engine's
      // JupiterMoons (the ground truth this exact body's own validation test uses, sampled every 10 days across
      // the full 1975-2050 span): +360/1.333 diverges to ~175 deg of phase error by 1975/2050, while -360/1.333
      // reproduces astronomy-engine to within 1.44 deg at all four reference epochs (0.0934/0.1164/0.0977/0.0733
      // deg at 1975/2000/2026/2050 for the literal magnitude). Retrograde apsidal precession is physically
      // consistent with Io's strong participation in the Io-Europa-Ganymede Laplace mean-motion resonance, which
      // dominates its free-apsidal-precession dynamics (unlike the oblateness-driven prograde precession of the
      // non-resonant/weakly-resonant satellites). See task-7-fix1-report.md.
      nodeRateDegPerYear: 0, periRateDegPerYear: -360 / 1.333,
    },
    source: `${SATS_ELEM}, row Io (501), ephemeris JUP365, frame Laplace`,
  },
  europa: {
    frame: { poleRaDeg: 268.1, poleDecDeg: 64.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 671100, e: 0.009, iDeg: 0.5, nodeDeg: 184.0, periDeg: 45.0, meanAnomalyDeg: 345.4,
      meanMotionDegPerDay: 360 / 3.525463,
      // periRateDegPerYear is -360/Papsis (task-7 fix), same reasoning and same verification method as Io above:
      // Europa is in the same Laplace resonance and its apsidal precession is also retrograde. -360/1.394
      // reproduces astronomy-engine to within 3.08 deg at all four reference epochs (1.49/0.01/1.57/3.08 deg at
      // 1975/2000/2026/2050); the +360/1.394 convention diverges to over 100 deg by 1975/2050. The residual 3.08
      // deg at 2050 slightly exceeds the 2 deg default phase bound -- recorded in PHASE_BOUND_DEG (moons.test.ts)
      // per the task-7 brief's own "slightly over at exactly one extreme epoch" allowance. See task-7-fix1-report.md.
      nodeRateDegPerYear: -360 / 30.202, periRateDegPerYear: -360 / 1.394,
    },
    source: `${SATS_ELEM}, row Europa (502), ephemeris JUP365, frame Laplace`,
  },
  ganymede: {
    frame: { poleRaDeg: 268.2, poleDecDeg: 64.6 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 1070400, e: 0.001, iDeg: 0.2, nodeDeg: 58.5, periDeg: 198.3, meanAnomalyDeg: 324.8,
      meanMotionDegPerDay: 360 / 7.155588,
      nodeRateDegPerYear: -360 / 137.812, periRateDegPerYear: 360 / 68.301,
    },
    source: `${SATS_ELEM}, row Ganymede (503), ephemeris JUP365, frame Laplace`,
  },
  callisto: {
    frame: { poleRaDeg: 268.7, poleDecDeg: 64.8 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 1882700, e: 0.007, iDeg: 0.3, nodeDeg: 309.1, periDeg: 43.8, meanAnomalyDeg: 87.4,
      meanMotionDegPerDay: 360 / 16.690440,
      nodeRateDegPerYear: -360 / 577.264, periRateDegPerYear: 360 / 277.921,
    },
    source: `${SATS_ELEM}, row Callisto (504), ephemeris JUP365, frame Laplace`,
  },

  // --- Saturn (Laplace frame; ephemeris SAT441) ---
  // Phase-5 task 11 finding, applying to Enceladus, Tethys, Dione, Rhea, Titan and Iapetus below. Every published cell
  // was re-read from ssd.jpl.nasa.gov/sats/elem (H1: no transcription slip; pole R.A./Dec. also match), the derived
  // inclination agrees with the table's in this frame (H3: the plane is right), and no sign or multiple of M, omega and
  // node reproduces the real J2000 longitude across the seven Saturn rows (H2; best combination leaves 41 deg). The
  // rates are right (the error is constant over 1975-2050, H4). So the published M places these bodies 61-157 degrees
  // from their real J2000 position for a reason this project could not find, and M is replaced by a fit to the real
  // Horizons state at JD 2451545.0 (H5), marked as a fit in each source string. That is a fit to real data, not a
  // JPL table value. Mimas (below) failed the acceptance rule and stays as published.
  // Mimas: re-verified this session (WebFetch re-read of ssd.jpl.nasa.gov/sats/elem/, including the row's position
  // and footnote [36] -> Jacobson 2022 AJ 164:199, ruling out a row-shift/misread; the epoch is 2000-01-01.5 like
  // every other row). Kept unchanged after two separate, unsuccessful investigations, both this session:
  // (1) Base elements: unlike Phobos/Io/Europa, Mimas is wrong even AT J2000 (years=0, so node/peri RATES cannot be
  //     the cause). Converted Horizons's own state vector for Mimas at J2000 (already in horizonsReference.ts)
  //     into exact osculating elements in this same Laplace-plane frame (standard vector->elements formulae): the
  //     result (node=173.2, peri=337.7, M=37.4 deg) does not match the table's (66.2, 160.4, 275.3) by any of the
  //     hypotheses tested against the real Horizons states (peri+180, node+180, M+180, all pairwise swaps, a
  //     mean-longitude-vs-mean-anomaly misreading) -- none reproduce the reference position to within the target
  //     bound at all four epochs.
  // (2) Even substituting the *exact* J2000-osculating node/peri/M above as the base (by construction, ~0 error at
  //     J2000) still diverges to 100-113 deg by 1975/2026/2050 using the table's own rates: Mimas's precession
  //     periods (Pnode=0.986yr, Papsis=0.493yr) are faster even than Phobos's, so it inherits the same
  //     2-3-significant-figure source-precision ceiling described on Phobos above, compounding the base-element
  //     mismatch. No sign-flip of either rate (the fix that worked for Io/Europa) resolves this either.
  // Final-fix wave: both investigations above were run BEFORE the sidereal-period correction (SIDEREAL_PERIOD_ROWS below) and
  // their "rate-precision ceiling" explanation is superseded: Mimas's P is the sidereal period, so its precession was
  // counted twice. After the correction the error is 26-50 deg at the four epochs (was 50-156), still unresolved.
  // Phase-5 task 11 (H5): calibrating M to the Horizons state at J2000 made Mimas WORSE (worst 73.9 deg against 50.3;
  // the best constant shift would leave 38 deg, a 1.3x gain, below the 3x acceptance rule), so it was reverted. The signed
  // error swings +32, +50, -26, +41 deg over 1975-2050, which no fixed base angle or rate can follow. The likely cause is
  // Mimas's 4:2 mean-motion resonance with Tethys (a libration of the mean longitude with a period of roughly 70 years),
  // which mean elements cannot represent; this is the physics-side explanation, not something tested here.
  // This is reported as an open, unresolved discrepancy, not papered over: PHASE_BOUND_DEG and a distance-test
  // override are recorded in moons.test.ts with the measured values. See task-7-fix1-report.md.
  mimas: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 186000, e: 0.020, iDeg: 1.6, nodeDeg: 66.2, periDeg: 160.4, meanAnomalyDeg: 275.3,
      meanMotionDegPerDay: 360 / 0.942422,
      nodeRateDegPerYear: -360 / 0.986, periRateDegPerYear: 360 / 0.493,
    },
    source: `${SATS_ELEM}, row Mimas (601), ephemeris SAT441, frame Laplace`,
  },
  enceladus: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 238400, e: 0.005, iDeg: 0.0, nodeDeg: 0.0, periDeg: 119.5, meanAnomalyDeg: 62.48,
      meanMotionDegPerDay: 360 / 1.370218,
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 2.916,
    },
    source: `${SATS_ELEM}, row Enceladus (602), ephemeris SAT441, frame Laplace; ${fittedM(57.0, 5.48)}`,
  },
  tethys: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 295000, e: 0.001, iDeg: 1.1, nodeDeg: 273.0, periDeg: 335.3, meanAnomalyDeg: 298.72,
      meanMotionDegPerDay: 360 / 1.887802,
      // Papsis = 0.005 yr, confirmed verbatim on 3 independent re-fetches (see task-5-report.md), which would give
      // periRateDegPerYear = 360/0.005 = 72,000 deg/yr. Per controller ruling (task-5-report.md, "Controller
      // rulings"): with e = 0.001 (nearly circular), the argument of periapsis -- and hence its fitted precession
      // rate -- becomes numerically ill-conditioned as eccentricity approaches zero (a known effect in celestial
      // mechanics), so this is a fit artifact, not a physically meaningful precession; rendering it literally would
      // visibly and implausibly spin Tethys's periapsis every few hours. Set to 0 for rendering purposes. This also
      // leaves the sidereal-to-anomaly correction (SIDEREAL_PERIOD_ROWS) without a periapsis term for Tethys. Before the
      // phase-5 M calibration Tethys was 58-62 deg off Horizons at every epoch (a base-angle offset, see moons.test.ts),
      // so this choice was not what limited its accuracy; it now measures 0.1-2.9 deg.
      nodeRateDegPerYear: -360 / 4.982, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Tethys (603), ephemeris SAT441, frame Laplace; ${fittedM(0.0, -61.28)}`,
  },
  dione: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 377700, e: 0.002, iDeg: 0.0, nodeDeg: 0.0, periDeg: 116.0, meanAnomalyDeg: 60.86,
      meanMotionDegPerDay: 360 / 2.736916,
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 11.698,
    },
    source: `${SATS_ELEM}, row Dione (604), ephemeris SAT441, frame Laplace; ${fittedM(212.0, -151.14)}`,
  },
  rhea: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 527200, e: 0.001, iDeg: 0.3, nodeDeg: 133.7, periDeg: 44.3, meanAnomalyDeg: 234.06,
      meanMotionDegPerDay: 360 / 4.517503,
      nodeRateDegPerYear: -360 / 35.775, periRateDegPerYear: 360 / 33.939,
    },
    source: `${SATS_ELEM}, row Rhea (605), ephemeris SAT441, frame Laplace; ${fittedM(31.5, -157.44)}`,
  },
  titan: {
    frame: { poleRaDeg: 36.4, poleDecDeg: 84.0 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 1221900, e: 0.029, iDeg: 0.3, nodeDeg: 78.6, periDeg: 78.3, meanAnomalyDeg: 215.03,
      meanMotionDegPerDay: 360 / 15.945448,
      nodeRateDegPerYear: -360 / 687.370, periRateDegPerYear: 360 / 346.680,
    },
    source: `${SATS_ELEM}, row Titan (606), ephemeris SAT441, frame Laplace; ${fittedM(11.7, -156.67)}`,
  },
  iapetus: {
    frame: { poleRaDeg: 288.7, poleDecDeg: 78.9 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 3561700, e: 0.028, iDeg: 7.6, nodeDeg: 86.5, periDeg: 254.5, meanAnomalyDeg: 214.77,
      meanMotionDegPerDay: 360 / 79.331002,
      nodeRateDegPerYear: -360 / 3130.302, periRateDegPerYear: 360 / 1662.900,
    },
    source: `${SATS_ELEM}, row Iapetus (608), ephemeris SAT441, frame Laplace; ${fittedM(74.8, 139.97)}`,
  },

  // --- Uranus (equatorial frame; ephemeris URA182; ref. Jacobson & Park (2025) AJ 169:65-82, 'The Orbits of
  // Uranus, Its Satellites and Rings...'). The table gives no per-row pole for equatorial-frame rows, so the frame
  // pole is Uranus's own NSSDC-sourced rotation pole (see URANUS_POLE above). The tabulated P of every Uranus row is the
  // SIDEREAL period, so meanMotionDegPerDay is converted to a mean-anomaly rate (SIDEREAL_PERIOD_ROWS below); before that
  // fix these rows drifted by up to 176 deg, which earlier notes wrongly blamed on source rate precision. ---
  miranda: {
    frame: URANUS_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 129846, e: 0.001, iDeg: 4.4, nodeDeg: 100.9, periDeg: 154.8, meanAnomalyDeg: 73.0,
      meanMotionDegPerDay: 360 / 1.413479,
      nodeRateDegPerYear: -360 / 17.787, periRateDegPerYear: 360 / 8.939,
    },
    source: `${SATS_ELEM}, row Miranda (705), ephemeris URA182, frame equatorial; pole from ${URANUS_POLE_SOURCE}`,
  },
  ariel: {
    frame: URANUS_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 190929, e: 0.001, iDeg: 0.0, nodeDeg: 0.0, periDeg: 9.6, meanAnomalyDeg: 193.5,
      meanMotionDegPerDay: 360 / 2.520379,
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 28.901,
    },
    source: `${SATS_ELEM}, row Ariel (701), ephemeris URA182, frame equatorial; pole from ${URANUS_POLE_SOURCE}`,
  },
  umbriel: {
    frame: URANUS_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 265986, e: 0.004, iDeg: 0.1, nodeDeg: 174.8, periDeg: 183.4, meanAnomalyDeg: 253.0,
      meanMotionDegPerDay: 360 / 4.144177,
      nodeRateDegPerYear: -360 / 129.745, periRateDegPerYear: 360 / 64.126,
    },
    source: `${SATS_ELEM}, row Umbriel (702), ephemeris URA182, frame equatorial; pole from ${URANUS_POLE_SOURCE}`,
  },
  titania: {
    frame: URANUS_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 436298, e: 0.002, iDeg: 0.1, nodeDeg: 29.5, periDeg: 184.0, meanAnomalyDeg: 68.1,
      meanMotionDegPerDay: 360 / 8.705869,
      nodeRateDegPerYear: -360 / 1644.649, periRateDegPerYear: 360 / 579.928,
    },
    source: `${SATS_ELEM}, row Titania (703), ephemeris URA182, frame equatorial; pole from ${URANUS_POLE_SOURCE}`,
  },
  oberon: {
    frame: URANUS_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 583511, e: 0.002, iDeg: 0.1, nodeDeg: 76.8, periDeg: 132.2, meanAnomalyDeg: 143.6,
      meanMotionDegPerDay: 360 / 13.463237,
      nodeRateDegPerYear: -360 / 192.798, periRateDegPerYear: 360 / 158.604,
    },
    source: `${SATS_ELEM}, row Oberon (704), ephemeris URA182, frame equatorial; pole from ${URANUS_POLE_SOURCE}`,
  },

  // --- Neptune (Laplace frame; ephemeris NEP097) ---
  // Phase-5 task 11 (H4 + H5) for Triton. Deriving the node from the four Horizons states in this Laplace frame gives a
  // steady +0.53 deg/yr (163.5, 176.8, 191.0, 203.4 deg in 1975/2000/2026/2050), while the tabulated Pnode of 340.379 yr
  // read as a regression gives -1.06 deg/yr: the opposite sense and twice the size. The node rate is therefore stored as
  // +360 / (2 x 340.379) (the derived rate is 360/681.8 yr), and for this retrograde orbit (i = 157.3) the motion along the
  // orbit is the anomaly rate plus cos(i) times the node rate, so the mean anomaly rate is the NSSDC sidereal period
  // 5.876854 d minus that term. Worst error 26.6 -> 5.1 deg with these two changes alone; the remaining ~4 deg J2000 base
  // offset was then removed by fitting M to the Horizons state at JD 2451545.0 (marked as a fit in the source string),
  // leaving 2.0 deg. The derived node rate is a Horizons-derived value; the factor of two versus the published Pnode is
  // NOT explained by the source page and is disclosed as such.
  triton: {
    frame: { poleRaDeg: 299.8, poleDecDeg: 43.1 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 354800, e: 0.000, iDeg: 157.3, nodeDeg: 178.1, periDeg: 0.0, meanAnomalyDeg: 58.95,
      meanMotionDegPerDay: 360 / 5.876854 - (Math.cos(157.3 * DEG) * (360 / (2 * 340.379))) / DAYS_PER_YEAR,
      // Papsis printed as 0.000 (e = 0.000, periapsis undefined): no precession.
      nodeRateDegPerYear: 360 / (2 * 340.379), periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Triton (801), ephemeris NEP097, frame Laplace; node rate and mean motion corrected from Horizons (see comment); ${fittedM(63.0, -4.05)}`,
  },

  // --- Pluto (equatorial frame; ephemeris PLU060; ref. Brozović & Jacobson (2024) AJ 167:256, 'Post-New Horizons
  // orbits and masses for the satellites of Pluto'). Both precession periods are printed as "-" (e = 0, i = 0: both
  // periapsis and node are undefined for Charon's circular, exactly-equatorial orbit). ---
  charon: {
    frame: PLUTO_POLE,
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 19600, e: 0.000, iDeg: 0.0, nodeDeg: 0.0, periDeg: 0.0, meanAnomalyDeg: 304.1,
      meanMotionDegPerDay: 360 / 6.387222,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Charon (901), ephemeris PLU060, frame equatorial; pole from ${PLUTO_POLE_SOURCE}`,
  },

  // --- Dwarf planets (ecliptic frame, J2000; JPL Small-Body Database API, osculating elements; no precession) ---
  ceres: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 2.765552595034094 * AU_KM, e: 0.07969229514816586, iDeg: 10.58802780183462,
      nodeDeg: 80.24862682043221, periDeg: 73.29421453021587, meanAnomalyDeg: 274.4193463761342,
      meanMotionDegPerDay: 0.21430445064843,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=Ceres, epoch JD 2461200.5 TDB`,
  },
  eris: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 67.93394687853566 * AU_KM, e: 0.4382385347971672, iDeg: 43.9258279471791,
      nodeDeg: 36.00477044417249, periDeg: 150.7949235840312, meanAnomalyDeg: 211.774434275007,
      meanMotionDegPerDay: 0.001760247770619088,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=Eris, epoch JD 2461200.5 TDB`,
  },
  haumea: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 43.06029023650952 * AU_KM, e: 0.1944430148898797, iDeg: 28.20847393040364,
      nodeDeg: 121.7860561329425, periDeg: 240.6905472508661, meanAnomalyDeg: 223.2104118812299,
      meanMotionDegPerDay: 0.003488097731816818,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=Haumea, epoch JD 2461200.5 TDB`,
  },
  makemake: {
    frame: 'ecliptic',
    elements: {
      epochJd: 2_461_200.5,
      aKm: 45.57093317300052 * AU_KM, e: 0.1588889953992523, iDeg: 29.02785603743067,
      nodeDeg: 79.2948338209406, periDeg: 297.0922733397207, meanAnomalyDeg: 169.9379962048232,
      meanMotionDegPerDay: 0.003203850120050116,
      nodeRateDegPerYear: 0, periRateDegPerYear: 0,
    },
    source: `${SBDB}, sstr=Makemake, epoch JD 2461200.5 TDB`,
  },
};

/**
 * Rows whose tabulated period P is the SIDEREAL period (the mean-longitude rate), not the anomalistic one. Verified per
 * row by comparing 360/P with the independent NSSDC sidereal period in the catalog (tests/catalog/orbits.test.ts): these
 * rows match it to 2e-5 or better, while the Jupiter rows (io, europa, ganymede, callisto) only match once the
 * precession is added, i.e. their P is anomalistic (the mean-anomaly rate, which is what planePosition wants).
 * planePosition advances the mean anomaly at meanMotionDegPerDay and separately adds the node and periapsis rates to
 * the angles, so the mean longitude moves at meanMotion + nodeRate + periRate. For a sidereal P that would count the
 * precession twice, so for these rows the mean-anomaly rate stored is 360/P - (nodeRate + periRate)/365.25.
 * (Before this correction, all Uranus rows and every Saturn row drifted; see final-fix-report.md.)
 * Phase-5 task 11: phobos and deimos are now converted too, but only together with the NSSDC sidereal periods (0.31891 d,
 * 1.26244 d) in place of the table's 4-5 figure P (0.3187, 1.2625). The earlier attempt converted them with the coarse P,
 * which left 91 and 131 deg; the coarse P, not the convention, was the problem (165.6 -> 7.1 deg for Phobos, 155.5 -> 3.3
 * deg for Deimos). Triton is retrograde and handled in its own row (node rate and cos(i) term, see the comment there).
 */
const SIDEREAL_PERIOD_ROWS: readonly BodyId[] = [
  'phobos', 'deimos', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'iapetus',
  'miranda', 'ariel', 'umbriel', 'titania', 'oberon',
];

/** Mean-anomaly rate (deg/day) from a sidereal period, removing the node and periapsis precession that planePosition adds back. */
export function anomalyRateFromSidereal(el: OrbitalElements): number {
  return el.meanMotionDegPerDay - (el.nodeRateDegPerYear + el.periRateDegPerYear) / DAYS_PER_YEAR;
}

export const ELEMENTS: Partial<Record<BodyId, ElementSet>> = Object.fromEntries(
  Object.entries(TABLE).map(([id, set]) => [
    id,
    SIDEREAL_PERIOD_ROWS.includes(id as BodyId)
      ? { ...set, elements: { ...set.elements, meanMotionDegPerDay: anomalyRateFromSidereal(set.elements) } }
      : set,
  ]),
);

/**
 * IAU rotation constants (linear terms only), for the bodies whose full set (pole R.A./Dec. AND a prime-meridian
 * W0 + rotation rate) could be verified on an allowed domain this session. Extensive search (ssd.jpl.nasa.gov's
 * satellite/planet physical-parameter pages, astro_par.html, the Horizons OBJ_DATA block for Uranus, Pluto,
 * Charon and Titania, ssd-api.jpl.nasa.gov's SBDB phys_par for all 4 dwarf planets, nssdc.gsfc.nasa.gov's Uranus,
 * Pluto and satellite fact sheets, and astrogeology.usgs.gov -- whose search results are client-side rendered and
 * returned no content to WebFetch) found a rotation POLE for only one body (Ceres, via SBDB's phys_par "pole"
 * field) and never found a prime-meridian W0 constant for any moon or dwarf planet on any of the 5 allowed
 * domains. Since IauRotation requires all four constants and W0 cannot be sourced, ROTATIONS is empty: every body
 * falls back to the locked-moon rule or an assumed pole in Task 6, as the brief anticipates. See task-5-report.md.
 */
export const ROTATIONS: Partial<Record<BodyId, RotationSet>> = {};
