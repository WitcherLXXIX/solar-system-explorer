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
const URANUS_POLE = { poleRaDeg: 257.311, poleDecDeg: -15.175 }; // NSSDC Uranus Fact Sheet, "North Pole of Rotation"
const PLUTO_POLE = { poleRaDeg: 132.99, poleDecDeg: -6.16 }; // NSSDC Pluto Fact Sheet, "Positive Pole of Rotation"
const URANUS_POLE_SOURCE = 'NASA NSSDC Uranus Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html), "North Pole of Rotation", epoch J2000';
const PLUTO_POLE_SOURCE = 'NASA NSSDC Pluto Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html), "Positive Pole of Rotation", epoch J2000';
const SBDB = 'JPL Small-Body Database API (ssd-api.jpl.nasa.gov/sbdb.api, full-prec=true), osculating elements, J2000 ecliptic';

export const ELEMENTS: Partial<Record<BodyId, ElementSet>> = {
  // --- Mars (Laplace frame; ephemeris MAR099; ref. Brozović, Jacobson, Park (2025) AJ, 'Revised Ephemerides of the
  // Martian Satellites, Phobos and Deimos') ---
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
      nodeRateDegPerYear: 0, periRateDegPerYear: 360 / 1.333,
    },
    source: `${SATS_ELEM}, row Io (501), ephemeris JUP365, frame Laplace`,
  },
  europa: {
    frame: { poleRaDeg: 268.1, poleDecDeg: 64.5 },
    elements: {
      epochJd: SAT_EPOCH_JD,
      aKm: 671100, e: 0.009, iDeg: 0.5, nodeDeg: 184.0, periDeg: 45.0, meanAnomalyDeg: 345.4,
      meanMotionDegPerDay: 360 / 3.525463,
      nodeRateDegPerYear: -360 / 30.202, periRateDegPerYear: 360 / 1.394,
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
