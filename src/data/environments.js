// Ambientazioni delle battaglie: cielo, nebbia, pioggia, citta' sullo sfondo.

export const ENVIRONMENTS = {
  menu: {
    skyTop: '#03050c', skyBottom: '#1a2240', horizon: '#45324f',
    fog: '#0b1222', fogDensity: 0.0095,
    rain: 0.8, snow: false, lightning: 0.35,
    water: '#05101a', city: 1, cityDist: 92, windows: '#ffd59a', neon: ['#ff3df0', '#3dfcff', '#ffb030'],
    searchlights: 4, wall: false, rift: false, ambient: 0.55, moon: 0.7,
  },
  tokyo: {
    skyTop: '#03050c', skyBottom: '#1d2448', horizon: '#4a3352',
    fog: '#0b1124', fogDensity: 0.009,
    rain: 0.85, snow: false, lightning: 0.35,
    water: '#05101a', city: 1, cityDist: 88, windows: '#ffd8a8', neon: ['#ff3df0', '#3dfcff', '#ff5a5a'],
    searchlights: 5, wall: false, rift: false, ambient: 0.55, moon: 0.7,
  },
  manila: {
    skyTop: '#05060c', skyBottom: '#2a2238', horizon: '#5e3a30',
    fog: '#120f1a', fogDensity: 0.01,
    rain: 1, snow: false, lightning: 0.55,
    water: '#0a0f14', city: 0.8, cityDist: 85, windows: '#ffc070', neon: ['#ff7a2a', '#ffd23a', '#3dfcff'],
    searchlights: 3, wall: false, rift: false, ambient: 0.5, moon: 0.5,
  },
  sydney: {
    skyTop: '#02040a', skyBottom: '#14233a', horizon: '#2c4a66',
    fog: '#0a1420', fogDensity: 0.011,
    rain: 1, snow: false, lightning: 0.8,
    water: '#04121a', city: 0.85, cityDist: 92, windows: '#cfe6ff', neon: ['#3dfcff', '#ffffff', '#46ff9a'],
    searchlights: 4, wall: false, rift: false, ambient: 0.5, moon: 0.6,
  },
  lima: {
    skyTop: '#060508', skyBottom: '#2a1f26', horizon: '#6a4030',
    fog: '#1a1418', fogDensity: 0.012,
    rain: 0.5, snow: false, lightning: 0.2,
    water: '#0c100f', city: 0.7, cityDist: 85, windows: '#ffb860', neon: ['#a6ff3a', '#ffb030', '#ff3d6a'],
    searchlights: 3, wall: false, rift: false, ambient: 0.55, moon: 0.4,
  },
  anchorage: {
    skyTop: '#060a14', skyBottom: '#2a3a52', horizon: '#6a7a92',
    fog: '#3a4658', fogDensity: 0.012,
    rain: 0, snow: true, lightning: 0,
    water: '#0c1a24', city: 0.55, cityDist: 88, windows: '#ffe2b0', neon: ['#3dfcff', '#ffffff'],
    searchlights: 3, wall: false, rift: false, ambient: 0.8, moon: 0.9,
  },
  sanfrancisco: {
    skyTop: '#04060c', skyBottom: '#252a40', horizon: '#6a4a3a',
    fog: '#1a1e2a', fogDensity: 0.014,
    rain: 0.6, snow: false, lightning: 1,
    water: '#071018', city: 0.9, cityDist: 95, windows: '#ffd59a', neon: ['#8a7dff', '#3dfcff', '#ff3d6a'],
    searchlights: 5, wall: false, bridge: true, rift: false, ambient: 0.5, moon: 0.6,
  },
  hongkong: {
    skyTop: '#04030a', skyBottom: '#2a1640', horizon: '#6a2a58',
    fog: '#150a1e', fogDensity: 0.0095,
    rain: 1, snow: false, lightning: 0.4,
    water: '#08091a', city: 1.3, cityDist: 85, windows: '#ffd0f0', neon: ['#ff3df5', '#3dfcff', '#ff2a55', '#ffe23a'],
    searchlights: 6, wall: true, rift: false, ambient: 0.55, moon: 0.4,
  },
  vladivostok: {
    skyTop: '#05080f', skyBottom: '#2a3444', horizon: '#566278',
    fog: '#2e3644', fogDensity: 0.016,
    rain: 0, snow: true, lightning: 0.1,
    water: '#0a141c', city: 0.6, cityDist: 85, windows: '#ffd8a0', neon: ['#ff2a2a', '#ffffff'],
    searchlights: 3, wall: true, rift: false, ambient: 0.75, moon: 0.8,
  },
  rift: {
    skyTop: '#020308', skyBottom: '#0a1a2a', horizon: '#0a4a5a',
    fog: '#061420', fogDensity: 0.012,
    rain: 0.9, snow: false, lightning: 0.7,
    water: '#020c14', city: 0, cityDist: 110, windows: '#ffd59a', neon: ['#3dfcff'],
    searchlights: 0, wall: false, rift: true, ambient: 0.45, moon: 0.4,
  },
};
