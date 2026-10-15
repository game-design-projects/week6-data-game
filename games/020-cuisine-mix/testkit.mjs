// tiny deterministic stand-ins for the engine's pick(): a stride walk over the pool by day
export const makeRng = () => ({});
export const dayPicker = (arr, day) => () => arr[(day * 37) % arr.length];
