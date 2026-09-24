import type { ReferenceState } from './horizonsReference';

/**
 * JPL Horizons vector tables (API 1.2), fetched 2026-09-24 via ssd.jpl.nasa.gov/api/horizons.api: heliocentric (CENTER 500@10),
 * ecliptic J2000, ICRF, km and km/s, TDB, at the four REFERENCE_EPOCHS_JD epochs (pairs outside two-body validity dropped, and extra 2010, 2015 and 2021 epochs added for hygiea and c67p; see the comments). Each body was fetched twice with
 * differently worded prompts and the digits agreed. Designations: 4;, 2;, 10;, 3; and DES=C/1995 O1; (one record). Halley, 67P and 109P
 * have several apparition records, so the record whose osculating epoch equals the SBDB epoch of the stored elements was used
 * (1P 90000030, 67P 90000703, 109P 90000985), so the comparison tests the two-body propagation and not a different orbit fit.
 */
export const SMALL_BODY_STATES: readonly ReferenceState[] = [
  // vesta (4;), center Sun
  { id: 'vesta', center: 'sun', jdTdb: 2442413.5, positionKm: [4.842046029979239e+07, -3.208719927059136e+08, 4.003969205047965e+06], velocityKmS: [2.073209716131579e+01, 2.379161135164614e+00, -2.589540509034280e+00] },
  { id: 'vesta', center: 'sun', jdTdb: 2451545.0, positionKm: [-2.024927512406044e+08, -2.502976814434996e+08, 3.214885338637935e+07], velocityKmS: [1.666493326235456e+01, -1.281751776285024e+01, -1.637447174855939e+00] },
  { id: 'vesta', center: 'sun', jdTdb: 2461304.5, positionKm: [3.527127970467111e+08, 8.769865345512855e+07, -4.555254852722933e+07], velocityKmS: [-3.009120648800261e+00, 1.843446155345815e+01, -1.807859910750782e-01] },
  { id: 'vesta', center: 'sun', jdTdb: 2469807.5, positionKm: [-2.917036538187300e+08, 2.120141852250824e+08, 2.930134870856754e+07], velocityKmS: [-9.617855883641187e+00, -1.621263735931332e+01, 1.645848386041830e+00] },

  // pallas (2;), center Sun
  // dropped (outside two-body validity, worse than 5 degrees or 3 percent against Horizons): JD 2451545.0
  { id: 'pallas', center: 'sun', jdTdb: 2442413.5, positionKm: [3.844264700733639e+08, -2.843825645207018e+08, 1.662949973026843e+08], velocityKmS: [8.366680766405461e+00, 9.201269155676984e+00, -7.023870027017472e+00] },
  { id: 'pallas', center: 'sun', jdTdb: 2461304.5, positionKm: [4.090440380389600e+08, 7.635407380303735e+07, -8.830081379620132e+07], velocityKmS: [-8.337727905646698e+00, 1.290397415792690e+01, -8.222748659180038e+00] },
  { id: 'pallas', center: 'sun', jdTdb: 2469807.5, positionKm: [3.294175592893984e+08, 1.635535216331423e+08, -1.427895030221310e+08], velocityKmS: [-1.353016889720171e+01, 1.122481727410937e+01, -6.572307504358978e+00] },

  // hygiea (10;), center Sun
  // dropped (outside two-body validity, worse than 5 degrees or 3 percent against Horizons): JD 2442413.5, 2451545.0, 2455197.5
  { id: 'hygiea', center: 'sun', jdTdb: 2461304.5, positionKm: [-3.289848548980569e+08, 3.442432792088456e+08, -1.621172654011346e+07], velocityKmS: [-1.068138438956642e+01, -1.267512525442907e+01, -8.878908412974482e-01] },
  { id: 'hygiea', center: 'sun', jdTdb: 2469807.5, positionKm: [-4.224781520339766e+08, -1.070260244135212e+08, -2.944601297787795e+07], velocityKmS: [5.818781259635788e+00, -1.707839758512243e+01, 1.605600034164540e-01] },
  { id: 'hygiea', center: 'sun', jdTdb: 2457023.5, positionKm: [-7.949609722628823e+07, 4.996736246220741e+08, 2.595233953323781e+06], velocityKmS: [-1.506486154541780e+01, -3.742312908673050e+00, -1.042084750805858e+00] },
  { id: 'hygiea', center: 'sun', jdTdb: 2459215.5, positionKm: [-2.716048868134751e+08, 4.004930386150653e+08, -1.158543104111871e+07], velocityKmS: [-1.239253285406049e+01, -1.056161236889943e+01, -9.695226704200777e-01] },

  // juno (3;), center Sun
  { id: 'juno', center: 'sun', jdTdb: 2442413.5, positionKm: [2.897119350765150e+08, 1.049864156745428e+08, -3.476826664711435e+07], velocityKmS: [-1.074327665634909e+01, 1.978609917184442e+01, -4.104455545563774e+00] },
  { id: 'juno', center: 'sun', jdTdb: 2451545.0, positionKm: [5.747210968510374e+07, -4.521488317040277e+08, 1.003294883255949e+08], velocityKmS: [1.456408100657909e+01, 4.634309788654771e+00, -1.623887448742247e+00] },
  { id: 'juno', center: 'sun', jdTdb: 2461304.5, positionKm: [2.787209796048638e+08, -2.776361197754781e+08, 5.164848433161974e+07], velocityKmS: [9.313702553556050e+00, 1.533501401870002e+01, -3.860919457265182e+00] },
  { id: 'juno', center: 'sun', jdTdb: 2469807.5, positionKm: [-2.310092759201813e+08, 2.538503493327277e+08, -4.741024444521909e+07], velocityKmS: [-1.820280056407602e+01, -9.671978881029844e+00, 2.974804491211771e+00] },

  // halley (record 90000030 (1P, epoch 1968)), center Sun
  { id: 'halley', center: 'sun', jdTdb: 2442413.5, positionKm: [-1.362476436449746e+09, 2.987844671719656e+09, -8.689815297949202e+08], velocityKmS: [3.307534601290053e+00, -3.899424224389695e+00, 1.556745589383393e+00] },
  { id: 'halley', center: 'sun', jdTdb: 2451545.0, positionKm: [-2.600907602197299e+09, 2.540048592419322e+09, -1.133650661578042e+09], velocityKmS: [-2.090848525010822e+00, 3.794072810318385e+00, -1.196851145512778e+00] },
  { id: 'halley', center: 'sun', jdTdb: 2461304.5, positionKm: [-2.896408050978722e+09, 4.109033780322703e+09, -1.474331866150234e+09], velocityKmS: [9.460239016990774e-01, 2.105919366897184e-01, 2.267131230908161e-01] },
  { id: 'halley', center: 'sun', jdTdb: 2469807.5, positionKm: [-1.421827088975400e+09, 3.035010221021159e+09, -8.922340214845128e+08], velocityKmS: [3.245832607021864e+00, -3.750255289837307e+00, 1.512996047994141e+00] },

  // halebopp (DES=C/1995 O1;), center Sun
  { id: 'halebopp', center: 'sun', jdTdb: 2442413.5, positionKm: [1.092652498040210e+09, -5.234987114039297e+09, -3.528387864233593e+09], velocityKmS: [-9.162159372769973e-01, 4.494699840940881e+00, 4.143543526593094e+00] },
  { id: 'halebopp', center: 'sun', jdTdb: 2451545.0, positionKm: [1.966551822693052e+07, -1.602688899462565e+08, -1.508053669026518e+09], velocityKmS: [1.008320474120734e+00, -5.165492373036090e+00, -1.193274336746354e+01] },
  { id: 'halebopp', center: 'sun', jdTdb: 2461304.5, positionKm: [6.644837836974372e+08, -3.333631835398124e+09, -6.851531919631820e+09], velocityKmS: [6.159200921991939e-01, -3.048060802190732e+00, -4.487162649935653e+00] },
  { id: 'halebopp', center: 'sun', jdTdb: 2469807.5, positionKm: [1.082277026341118e+09, -5.359691420449972e+09, -9.734751811849693e+09], velocityKmS: [5.135813044861451e-01, -2.531525602194977e+00, -3.490931797446880e+00] },

  // c67p (record 90000703 (67P, epoch 2015)), center Sun
  // dropped (outside two-body validity, worse than 5 degrees or 3 percent against Horizons): JD 2442413.5, 2461304.5, 2469807.5, 2459215.5
  { id: 'c67p', center: 'sun', jdTdb: 2451545.0, positionKm: [-2.435753566168143e+08, -7.943848685427592e+08, -3.882879348162115e+07], velocityKmS: [8.112374627810944e+00, 8.244779172133537e-02, -7.811797184248489e-01] },
  { id: 'c67p', center: 'sun', jdTdb: 2455197.5, positionKm: [-4.737444588183467e+08, -6.292160844717339e+07, 3.997350473325554e+07], velocityKmS: [-9.221580207457091e+00, -1.457101268955883e+01, -2.773627278982804e-01] },
  { id: 'c67p', center: 'sun', jdTdb: 2457023.5, positionKm: [2.625574713254249e+08, -2.924316643014585e+08, -4.803585796906205e+07], velocityKmS: [3.658407503995179e+00, 1.998204608006295e+01, 1.234765677994374e+00] },

  // swifttuttle (record 90000985 (109P, epoch 1995)), center Sun
  { id: 'swifttuttle', center: 'sun', jdTdb: 2442413.5, positionKm: [-3.759790758983879e+09, 2.594539476572621e+09, -1.087696276013616e+09], velocityKmS: [3.686508359802758e+00, -1.882196534765811e+00, 2.205032359820543e+00] },
  { id: 'swifttuttle', center: 'sun', jdTdb: 2451545.0, positionKm: [-1.881215195829035e+09, 5.516024046239575e+08, -1.858348229059183e+09], velocityKmS: [-6.277056509610007e+00, 3.135757522292310e+00, -3.917856285877076e+00] },
  { id: 'swifttuttle', center: 'sun', jdTdb: 2461304.5, positionKm: [-4.985178821316583e+09, 2.384244056700209e+09, -3.293375429064510e+09], velocityKmS: [-2.176566548954929e+00, 1.517503529619278e+00, -5.732709105671895e-01] },
  { id: 'swifttuttle', center: 'sun', jdTdb: 2469807.5, positionKm: [-5.989996469770587e+09, 3.209662486866101e+09, -3.347676072795792e+09], velocityKmS: [-6.552938780144474e-01, 7.467575233254665e-01, 3.527797602266449e-01] },

];
