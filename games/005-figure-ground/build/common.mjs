export const rawName = (name, lat, lng) => `${name.replace(/\W+/g, '_')}_${lat.toFixed(4)}_${lng.toFixed(4)}.json`;
