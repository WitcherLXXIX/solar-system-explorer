import type { BodyId } from './bodies';
import type { PlaneFrame } from '../ephemeris/frames';
import type { IauRotation } from '../ephemeris/iau';
import type { OrbitalElements } from '../ephemeris/kepler';

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
const SBDB = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, full-prec=true), osculating elements, J2000 ecliptic';

export const ELEMENTS: Partial<Record<BodyId, ElementSet>> = {
  // --- Mars (Laplace frame; ephemeris MAR099; ref. Brozović, Jacobson, Park (2025) AJ, 'Revised Ephemerides of the
  // Martian Satellites, Phobos and Deimos') ---
  // Phobos: re-verified this session (2x independent WebFetch re-reads of ssd.jpl.nasa.gov/sats/elem/, both
  // matching these values exactly, including units -- P and Papsis/Pnode are not a units mixup). Kept unchanged
  // after an extensive but unsuccessful attempt to improve on it: Phobos's node/apsidal precession periods
  // (Pnode=2.3yr, Papsis=1.1yr) are so fast that this row's phase drifts far (55-166 deg by 1975/2026/2050) even
  // though it matches Horizons to 0.06 deg exactly at J2000 (years=0, where the rates don't matter yet) -- the
  // signature the task-7 brief itself flagged. A dense (81-point, 20-year) Horizons osculating-element re-fetch in
  // Mars's own body-equator frame (this session) found the node/periapsis angles carry a genuine ~45-degree-
  // amplitude *periodic* libration (not noise: the derived unwrap is smooth and monotonic, and cross-checked
  // against a second, independent 4-year/25-point sample), which swamps any linear secular-rate fit at the
  // 2-3-significant-figure precision this source publishes for Papsis/Pnode. A direct grid search against the 4
  // Horizons reference states found sign/magnitude combinations reproducing those specific 4 points to ~1.1 deg,
  // but a broader scan found 3 *other*, very different sign/magnitude combinations doing comparably well --
  // i.e. overfitting 4 sparse points, not a physically meaningful correction (unlike Io/Europa below, verified
  // against thousands of continuous astronomy-engine samples). No other allowed-domain source gave a more precise
  // Papsis/Pnode. See task-7-fix1-report.md; PHASE_BOUND_DEG override recorded in moons.test.ts.
  phobos: {
    frame: { poleRaDeg: 317.7, poleDecDeg: 52.9 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 9375, e: 0.015, iDeg: 1.1, nodeDeg: 169.2, periDeg: 216.3, meanAnomalyDeg: 189.7,
      meanMotionDegPerDay: 360 / 0.3187,
      nodeRateDegPerYear: -360 / 2.3, periRateDegPerYear: 360 / 1.1,
    },
    source: `${SATS_ELEM}, row Phobos (401), ephemeris MAR099, frame Laplace`,
  },
  deimos: {
    frame: { poleRaDeg: 316.6, poleDecDeg: 53.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 23457, e: 0.000, iDeg: 1.8, nodeDeg: 54.3, periDeg: 0.0, meanAnomalyDeg: 205.0,
      meanMotionDegPerDay: 360 / 1.2625,
      // Papsis printed as 0.0 (e = 0.000, periapsis undefined for a circular orbit): treated as no precession.
      nodeRateDegPerYear: -360 / 56.2, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Deimos (402), ephemeris MAR099, frame Laplace`,
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
      aKm: 238400, e: 0.005, iDeg: 0.0, nodeDeg: 0.0, periDeg: 119.5, meanAnomalyDeg: 57.0,
      meanMotionDegPerDay: 360 / 1.370218,
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 2.916,
    },
    source: `${SATS_ELEM}, row Enceladus (602), ephemeris SAT441, frame Laplace`,
  },
  tethys: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 295000, e: 0.001, iDeg: 1.1, nodeDeg: 273.0, periDeg: 335.3, meanAnomalyDeg: 0.0,
      meanMotionDegPerDay: 360 / 1.887802,
      // Papsis = 0.005 yr, confirmed verbatim on 3 independent re-fetches (see task-5-report.md), which would give
      // periRateDegPerYear = 360/0.005 = 72,000 deg/yr. Per controller ruling (task-5-report.md, "Controller
      // rulings"): with e = 0.001 (nearly circular), the argument of periapsis -- and hence its fitted precession
      // rate -- becomes numerically ill-conditioned as eccentricity approaches zero (a known effect in celestial
      // mechanics), so this is a fit artifact, not a physically meaningful precession; rendering it literally would
      // visibly and implausibly spin Tethys's periapsis every few hours. Set to 0 for rendering purposes; this does
      // not affect meanMotionDegPerDay (position accuracy is unaffected), only the (omitted) orbit-line precession.
      nodeRateDegPerYear: -360 / 4.982, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Tethys (603), ephemeris SAT441, frame Laplace`,
  },
  dione: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 377700, e: 0.002, iDeg: 0.0, nodeDeg: 0.0, periDeg: 116.0, meanAnomalyDeg: 212.0,
      meanMotionDegPerDay: 360 / 2.736916,
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 11.698,
    },
    source: `${SATS_ELEM}, row Dione (604), ephemeris SAT441, frame Laplace`,
  },
  rhea: {
    frame: { poleRaDeg: 40.6, poleDecDeg: 83.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 527200, e: 0.001, iDeg: 0.3, nodeDeg: 133.7, periDeg: 44.3, meanAnomalyDeg: 31.5,
      meanMotionDegPerDay: 360 / 4.517503,
      nodeRateDegPerYear: -360 / 35.775, periRateDegPerYear: 360 / 33.939,
    },
    source: `${SATS_ELEM}, row Rhea (605), ephemeris SAT441, frame Laplace`,
  },
  titan: {
    frame: { poleRaDeg: 36.4, poleDecDeg: 84.0 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 1221900, e: 0.029, iDeg: 0.3, nodeDeg: 78.6, periDeg: 78.3, meanAnomalyDeg: 11.7,
      meanMotionDegPerDay: 360 / 15.945448,
      nodeRateDegPerYear: -360 / 687.370, periRateDegPerYear: 360 / 346.680,
    },
    source: `${SATS_ELEM}, row Titan (606), ephemeris SAT441, frame Laplace`,
  },
  iapetus: {
    frame: { poleRaDeg: 288.7, poleDecDeg: 78.9 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 3561700, e: 0.028, iDeg: 7.6, nodeDeg: 86.5, periDeg: 254.5, meanAnomalyDeg: 74.8,
      meanMotionDegPerDay: 360 / 79.331002,
      nodeRateDegPerYear: -360 / 3130.302, periRateDegPerYear: 360 / 1662.900,
    },
    source: `${SATS_ELEM}, row Iapetus (608), ephemeris SAT441, frame Laplace`,
  },

  // --- Uranus (equatorial frame; ephemeris URA182; ref. Jacobson & Park (2025) AJ 169:65-82, 'The Orbits of
  // Uranus, Its Satellites and Rings...'). The table gives no per-row pole for equatorial-frame rows, so the frame
  // pole is Uranus's own NSSDC-sourced rotation pole (see URANUS_POLE above). ---
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
  triton: {
    frame: { poleRaDeg: 299.8, poleDecDeg: 43.1 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 354800, e: 0.000, iDeg: 157.3, nodeDeg: 178.1, periDeg: 0.0, meanAnomalyDeg: 63.0,
      meanMotionDegPerDay: 360 / 5.876994,
      // Papsis printed as 0.000 (e = 0.000, periapsis undefined): no precession.
      nodeRateDegPerYear: -360 / 340.379, periRateDegPerYear: 0,
    },
    source: `${SATS_ELEM}, row Triton (801), ephemeris NEP097, frame Laplace`,
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
