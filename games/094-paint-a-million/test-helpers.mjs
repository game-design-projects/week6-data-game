// minimal stand-ins for the engine's rng/pick so game.test.mjs runs standalone
export const makeRng = (seed) => ({ float: () => ((seed * 9301 + 49297) % 233280) / 233280 });
export const pickForDay = (arr, day) => arr[(day * 7919) % arr.length];
