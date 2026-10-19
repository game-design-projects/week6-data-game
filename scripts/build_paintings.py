#!/usr/bin/env python3
"""Builds web/levels.js and web/paintings/: one public-domain painting a day from the Art
Institute of Chicago, with one region's color taken out for the player to put back.

    pip install -r scripts/requirements.txt
    python3 scripts/build_paintings.py --days 60

For each painting:
  1. split it into superpixels (SLIC), then merge neighbours whose OKLab means are close,
     so each region is one patch of roughly one color;
  2. score every region: a subject-sized patch that stands out from what surrounds it, is
     fairly even inside, and doesn't hug the frame (that is usually sky or background);
  3. the answer is the region's mean color in OKLab;
  4. web/paintings/<id>.jpg keeps the region's shading but not its color: each pixel is stored
     as a neutral gray plus its offset from the mean, so the game can repaint it in any color
     the player picks; web/paintings/<id>-full.jpg is the original, shown at the end.

API replies and downloads are cached in data/aic-cache/ (git-ignored), so re-runs are offline.
data/aic-cache/review.jpg is a contact sheet of every pick with its region outlined.
"""
import argparse
import json
import random
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from skimage import graph, measure, morphology, segmentation

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / 'data' / 'aic-cache'
OUT_IMG = ROOT / 'web' / 'paintings'
API = 'https://api.artic.edu/api/v1/artworks/search'
IIIF = 'https://www.artic.edu/iiif/2/{}/full/843,/0/default.jpg'
UA = 'week6-data-game/1.0 (+https://github.com/game-design-projects/week6-data-game)'
# The museum asks for AIC-User-Agent; its image server turns away Python's default User-Agent.
HEADERS = {'AIC-User-Agent': UA, 'User-Agent': UA, 'Content-Type': 'application/json'}
FIELDS = ['id', 'title', 'artist_title', 'artist_display', 'date_display', 'image_id', 'thumbnail', 'credit_line', 'place_of_origin']
MAX_SIDE = 560
NEUTRAL = np.array([0.62, 0.0, 0.0])  # what an unpainted region is stored as; must match NEUTRAL in web/painting.js
# Patches are merged on color more than on light: the game keeps a region's shading, so one
# object lit from the side should still be one region. Tried at several strengths, best wins.
LIGHT_WEIGHT = 0.35
MERGES = (0.035, 0.05, 0.07)  # weighted OKLab distance under which neighbouring superpixels are one patch

# ---------- OKLab (Björn Ottosson), on arrays of shape (..., 3) ----------
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])


def to_linear(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def to_gamma(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * c ** (1 / 2.4) - 0.055)


def srgb_to_oklab(rgb):
    return np.cbrt(to_linear(rgb) @ M1.T) @ M2.T


def oklab_to_srgb(lab):
    lms = (lab @ np.linalg.inv(M2).T) ** 3
    return to_gamma(lms @ np.linalg.inv(M1).T)


def hex_of(rgb):
    return '#' + ''.join(f'{round(float(x) * 255):02X}' for x in np.clip(rgb, 0, 1))


def rgb_of(hex_):
    return np.array([int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)])


# ---------- data ----------
def fetch_json(name, body):
    path = CACHE / f'{name}.json'
    if path.exists():
        return json.loads(path.read_text())
    req = urllib.request.Request(API, data=json.dumps(body).encode(), headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.load(r)
    path.write_text(json.dumps(data))
    return data


def fetch_image(image_id):
    path = CACHE / 'img' / f'{image_id}.jpg'
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        req = urllib.request.Request(IIIF.format(image_id), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=60) as r:
            path.write_bytes(r.read())
    return path


def artworks(pages):
    """Public-domain paintings the museum highlights (is_boosted), which skews toward the famous ones."""
    out = []
    for page in range(1, pages + 1):
        body = {
            'query': {'bool': {'filter': [
                {'term': {'is_public_domain': True}},
                {'term': {'artwork_type_id': 1}},  # Painting
                {'term': {'is_boosted': True}},
                {'exists': {'field': 'image_id'}},
            ]}},
            'fields': FIELDS, 'limit': 100, 'page': page,
        }
        data = fetch_json(f'search-{page}', body)
        out += [a for a in data['data'] if a.get('image_id')]
        if page >= data['pagination']['total_pages']:
            break
    return out


def survey():
    rows = [line.split('\t') for line in (ROOT / 'data' / 'xkcd-rgb.txt').read_text().splitlines() if line.strip() and not line.startswith('#')]
    names = [r[0].strip() for r in rows]
    labs = srgb_to_oklab(np.array([rgb_of(r[1].strip().upper()) for r in rows]))
    return names, labs


# ---------- picking the region ----------
def merge_patches(labw, labels, thresh):
    rag = graph.rag_mean_color(labw, labels, mode='distance')

    def weight(g, src, dst, n):
        diff = g.nodes[dst]['mean color'] - g.nodes[n]['mean color']
        return {'weight': np.linalg.norm(diff)}

    def merge(g, src, dst):
        d = g.nodes[dst]
        d['total color'] += g.nodes[src]['total color']
        d['pixel count'] += g.nodes[src]['pixel count']
        d['mean color'] = d['total color'] / d['pixel count']

    return graph.merge_hierarchical(labels, rag, thresh=thresh, rag_copy=False, in_place_merge=True, merge_func=merge, weight_func=weight)


def clean(mask):
    """Smooth the edge, fill small holes, keep the biggest piece."""
    mask = ndimage.binary_opening(mask, structure=morphology.disk(2))
    mask = ndimage.binary_closing(mask, structure=morphology.disk(3), border_value=0) | mask
    holes, n = ndimage.label(ndimage.binary_fill_holes(mask) & ~mask)
    if n:
        small = np.flatnonzero(np.bincount(holes.ravel()) < mask.sum() * 0.05)
        mask |= np.isin(holes, small[small > 0])
    parts = measure.label(mask)
    if parts.max() == 0:
        return mask
    biggest = np.argmax(np.bincount(parts.ravel())[1:]) + 1
    return parts == biggest


def candidates(lab):
    h, w, _ = lab.shape
    rgb = oklab_to_srgb(lab)
    labw = lab * [LIGHT_WEIGHT, 1, 1]
    labels = segmentation.slic(rgb, n_segments=700, compactness=12, start_label=0)
    total = h * w
    frame = np.zeros((h, w), bool)
    frame[:3, :] = frame[-3:, :] = frame[:, :3] = frame[:, -3:] = True
    seen = []
    for thresh in MERGES:
        patches = merge_patches(labw, labels, thresh)
        for k in np.unique(patches):
            c = region(lab, labw, patches == k, total, frame)
            # the same region found at two strengths counts once
            if c and not any((c['mask'] & s['mask']).sum() > 0.8 * max(c['mask'].sum(), s['mask'].sum()) for s in seen):
                seen.append(c)
                yield c


def region(lab, labw, raw, total, frame):
    """Score one patch as the hidden region, or None if it is unfit."""
    if not 0.025 * total < raw.sum() < 0.3 * total:
        return None
    mask = clean(raw)
    area = mask.sum() / total
    if not 0.025 < area < 0.22:
        return None
    mean = lab[mask].mean(0)
    spread = np.sqrt(((labw[mask] - mean * [LIGHT_WEIGHT, 1, 1]) ** 2).sum(1).mean())
    ring = ndimage.binary_dilation(mask, structure=morphology.disk(8)) & ~mask
    contrast = np.linalg.norm(lab[ring].mean(0) - mean)
    on_frame = (mask & frame).sum() / max(1, frame.sum()) * 4  # share of one side's length
    props = measure.regionprops(mask.astype(np.uint8))[0]
    chroma = np.hypot(mean[1], mean[2])
    if spread > 0.06 or contrast < 0.07 or props.solidity < 0.45 or on_frame > 0.35 or chroma < 0.025:
        return None
    score = 2 * contrast + 1.2 * chroma + 0.8 * min(area, 0.15) - 0.6 * spread - 0.3 * on_frame
    return {'mask': mask, 'mean': mean, 'score': score, 'area': area, 'contrast': contrast, 'spread': spread}


def rle(mask):
    """Runs of the region in row-major order, flattened to [start, length, start, length, ...]."""
    flat = np.concatenate([[0], mask.ravel().astype(np.int8), [0]])
    edges = np.flatnonzero(np.diff(flat))
    starts, ends = edges[::2], edges[1::2]
    return np.column_stack([starts, ends - starts]).ravel().tolist()


def build(art, names, survey_labs):
    img = Image.open(fetch_image(art['image_id'])).convert('RGB')
    img.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    rgb = np.asarray(img) / 255
    lab = srgb_to_oklab(rgb)
    best = max(candidates(lab), key=lambda c: c['score'], default=None)
    if best is None:
        return None
    mask = best['mask']
    hex_ = hex_of(oklab_to_srgb(best['mean']))
    answer = srgb_to_oklab(rgb_of(hex_))  # the gamut-clamped mean, so a perfect pick restores every pixel
    hidden = lab.copy()
    hidden[mask] = NEUTRAL + (lab[mask] - answer)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    pid = str(art['id'])
    Image.fromarray((oklab_to_srgb(hidden) * 255).round().astype(np.uint8)).save(OUT_IMG / f'{pid}.jpg', quality=90, subsampling=0, optimize=True)
    img.save(OUT_IMG / f'{pid}-full.jpg', quality=86, subsampling=0, optimize=True)
    crowd = names[int(np.argmin(np.linalg.norm(survey_labs - answer, axis=1)))]
    return {
        'id': pid,
        'title': art['title'],
        'artist': art.get('artist_title') or (art.get('artist_display') or 'Unknown artist').split('\n')[0],
        'date': art.get('date_display') or '',
        'credit': art.get('credit_line') or '',
        'url': f"https://www.artic.edu/artworks/{art['id']}",
        'w': img.width, 'h': img.height,
        'hex': hex_,
        'crowd': crowd,
        'area': round(float(best['area']), 3),
        'mask': rle(mask),
        '_review': (img, mask),
    }


def contact_sheet(levels, path):
    tiles = []
    for lv in levels:
        img, mask = lv['_review']
        tile = img.copy()
        edge = mask & ~ndimage.binary_erosion(mask, structure=morphology.disk(2))
        px = np.asarray(tile).copy()
        px[edge] = [0, 255, 255]
        tile = Image.fromarray(px)
        tile.thumbnail((260, 260))
        canvas = Image.new('RGB', (260, 300), 'white')
        canvas.paste(tile, ((260 - tile.width) // 2, 0))
        d = ImageDraw.Draw(canvas)
        d.rectangle([4, 266, 40, 296], fill=lv['hex'])
        d.text((46, 266), f"{lv['id']} {lv['crowd']}"[:34], fill='black')
        d.text((46, 282), lv['title'][:34], fill='black')
        tiles.append(canvas)
    cols = 6
    sheet = Image.new('RGB', (cols * 260, -(-len(tiles) // cols) * 300), 'white')
    for i, t in enumerate(tiles):
        sheet.paste(t, ((i % cols) * 260, (i // cols) * 300))
    sheet.save(path, quality=80)


def daily_order(levels, seed):
    """Seeded shuffle, then never the same artist within three days."""
    rand = random.Random(seed)
    pool = levels[:]
    rand.shuffle(pool)
    out = []
    while pool:
        i = next((i for i, lv in enumerate(pool) if lv['artist'] not in [o['artist'] for o in out[-3:]]), 0)
        out.append(pool.pop(i))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--days', type=int, default=60)
    ap.add_argument('--pages', type=int, default=4)
    ap.add_argument('--epoch', default='2026-10-17')
    ap.add_argument('--seed', type=int, default=4553)
    ap.add_argument('--skip', default='', help='comma-separated artwork ids to leave out after reviewing the contact sheet')
    args = ap.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    skip = set(filter(None, args.skip.split(',')))
    names, labs = survey()
    levels = []
    for art in artworks(args.pages):
        if str(art['id']) in skip:
            continue
        thumb = art.get('thumbnail') or {}
        if thumb.get('width') and thumb.get('height') and not 0.45 < thumb['width'] / thumb['height'] < 2.2:
            continue  # scrolls and panoramas don't fit the screen
        try:
            lv = build(art, names, labs)
        except Exception as e:  # one bad download shouldn't sink the build
            print(f"[paintings] {art['id']} {art['title']}: {e}")
            continue
        if lv:
            levels.append(lv)
            print(f"[paintings] {len(levels):3} {lv['id']} {lv['hex']} {lv['crowd']:<22} {lv['title'][:50]}")
    levels = daily_order(levels, args.seed)[:args.days]
    contact_sheet(levels, CACHE / 'review.jpg')
    keep = {f'{lv["id"]}.jpg' for lv in levels} | {f'{lv["id"]}-full.jpg' for lv in levels}
    for f in OUT_IMG.glob('*.jpg'):
        if f.name not in keep:
            f.unlink()
    for lv in levels:
        del lv['_review']
    src = (f"// Generated by scripts/build_paintings.py (--seed {args.seed}). Do not edit by hand.\n"
           f"// Paintings: Art Institute of Chicago, public domain (CC0 data, open-access images).\n"
           f"export const EPOCH = '{args.epoch}';\n"
           f"export const LEVELS = {json.dumps(levels, ensure_ascii=False, separators=(',', ':'))};\n")
    (ROOT / 'web' / 'levels.js').write_text(src)
    print(f'[paintings] wrote {len(levels)} levels; review the picks in {CACHE / "review.jpg"}')


if __name__ == '__main__':
    main()
