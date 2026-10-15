// #98 Described — text-only GeoGuessr. A photo was described offline; you only read the description.
export const WORLD = [[-58, -170], [78, 180]];

/** Everything in `q` that is visible before the guess — used by tests to scan for answer leaks. */
export function visibleText(q) {
  return [q.desc, q.signs].filter(Boolean).join('\n');
}

export default {
  meta: {
    num: 98,
    slug: 'described',
    title: 'Described',
    tagline: 'A text-only GeoGuessr: read a description of a street photo, with no picture, and drop a pin on the world map.',
    category: 'model',
    data: 'snapshot',
    howTo: [
      'Read the description of the photo. Vehicles, building materials, vegetation, climate and what people wear are all clues.',
      'If the photo has legible text, it is listed separately. Recognizing the language or alphabet can often narrow things to a country or two.',
      'Drop a pin where you think the photo was taken (the map has no labels until you lock in), then confirm.',
      'On the reveal you see the original photo and which detail in the description gave the location away.',
    ],
    scoring: '100 × e^(−distance / 2,000 km): a miss of 0 km scores 100, about 2,000 km scores 37, and guessing the right continent usually earns 20 or more.',
    sources: [
      { name: 'Wikimedia Commons: geotagged street photos', url: 'https://commons.wikimedia.org/wiki/Commons:Geocoding', note: 'Photos and coordinates come from the MediaWiki geosearch API; the author and license are shown with each photo' },
      { name: 'MediaWiki API: GeoData / geosearch', url: 'https://www.mediawiki.org/wiki/Extension:GeoData' },
    ],
    dataNote: 'The plan was to use Mapillary, but its API needs a key and cannot be called straight from a browser, so the game uses geotagged street photos from Wikimedia Commons instead (no key needed). There is no vision model in the browser: each description was written offline at build time by an AI looking at the photo, and it describes only the scene, never place names. Coordinates are the position a Commons user tagged the photo with, which may be the camera or the subject; the error is usually a few hundred meters to a few kilometers.',
  },

  puzzle({ data, pick }) {
    return { id: pick(data.puzzles).id };
  },

  async play(ctx, p) {
    const { ui } = ctx;
    const q = ctx.data.puzzles.find((x) => x.id === p.id);
    ctx.log('puzzle', { id: q.id, city: q.city });

    ctx.stage.append(ui.panel({ kicker: 'Vision-model description', title: "What's in the photo?" },
      ui.quote(q.desc),
      q.signs ? ui.callout(`Text in the picture: ${q.signs}`, 'warn') : null,
      ui.h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'You cannot see the photo. Work out where in the world it is from the description alone.')));

    // Whole-world fit at any width: fractional zoom, minZoom 0, refit until the player touches the map.
    const fitWorld = async ({ map, el }) => {
      map.options.zoomSnap = 0;
      map.options.zoomDelta = 0.5;
      map.setMinZoom(0);
      let touched = false;
      for (const ev of ['pointerdown', 'wheel']) el.addEventListener(ev, () => { touched = true; }, { once: true, passive: true });
      const fit = () => { if (!touched && el.clientWidth) map.fitBounds(WORLD, { animate: false, padding: [2, 2] }); };
      fit();
      requestAnimationFrame(fit);
      map.on('resize', fit);
      ctx.log('fit world', { w: el.clientWidth, h: el.clientHeight });
    };

    const res = await ctx.pin({
      answer: { lat: q.lat, lng: q.lng, label: `${q.city}, ${q.country}` },
      view: { center: [20, 10], zoom: 1, minZoom: 0 },
      height: 'min(60vw, 420px)',
      scale: 2000,
      title: 'Where was it taken?',
      setup: fitWorld,
    });

    res.detail = ui.h('div', { class: 'ds-stack' },
      ui.h('img', { src: q.img, alt: `${q.city}: ${q.title}`, loading: 'lazy', style: { width: '100%', height: 'auto', borderRadius: 'var(--radius, 8px)', display: 'block' } }),
      ui.kv([
        ['Place', `${q.city}, ${q.country}`],
        ['The clue', q.why],
        ['Photo credit', `${q.artist || 'Unknown author'} · ${q.lic || ''}`],
        ['Original page', ui.h('a', { href: q.page, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons')],
      ]));
    return res;
  },
};
