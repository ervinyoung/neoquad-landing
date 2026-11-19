"""Draw the maps that let the dusk photograph move like a real place (read by src/scripts/living-coast.ts).

    python3 -m pip install numpy pillow   # once
    python3 tools/coast-maps.py

Source : src/assets/photos/dusk.jpg
Output : src/assets/photos/dusk-map.webp    red = sea, green = sky, blue = how near the land is (0 far, 1 near),
                                            the blue smooth and defined everywhere so the land moves as one body.
         src/assets/photos/dusk-plate.webp  the sky and sea with the land taken out (filled from around it),
                                            for the slivers the land uncovers as the camera drifts.
         src/assets/photos/dusk-sky.webp    the whole sky, full size, reaching a tenth of the picture past
                                            each side and on behind the land, so the clouds can travel.
The map and plate are small (960x540 and 480x270): the map's edges are anti-aliased, and the plate is only
ever seen a few pixels deep. Run again after changing the photograph.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, 'src', 'assets', 'photos')
WORK = (1920, 1080)   # segment at this size, then halve, so the edges come out anti-aliased
OUT = (960, 540)
HORIZON = 0.5426      # the sea's horizon, as a fraction of the picture's height (also in Coast.astro)
BRIGHT = 0.37         # sky and sea are lighter than this; the rocks are darker
REACH = 0.1           # how far the sky reaches past each side of the picture (also in Coast.astro)


def flood(binary, seeds):
    """The parts of a 0/255 mask connected to any seed that lands on white."""
    img = Image.fromarray(binary).copy()  # a copy: an image over a numpy buffer ignores writes
    for seed in seeds:
        if img.getpixel(seed) == 255:
            ImageDraw.floodfill(img, seed, 128)
    return np.asarray(img) == 128


def blur(a, radius):
    """A float blur (three box passes down, three across), so faint weights do not band as in 8 bits."""
    n = 2 * radius + 1
    for _ in range(3):
        c = np.cumsum(np.pad(a, [(radius + 1, radius), (0, 0)], mode='edge'), axis=0)
        a = (c[n:] - c[:-n]) / n
        c = np.cumsum(np.pad(a, [(0, 0), (radius + 1, radius)], mode='edge'), axis=1)
        a = (c[:, n:] - c[:, :-n]) / n
    return a


def fill_inward(image, known):
    """Fill the unknown pixels of an image with the colour of the nearest known ones, by normalised
    blurs that grow wider."""
    out = image * known[..., None]
    filled = known.copy()
    for radius in sorted({round(1.35**k) for k in range(19)}):
        weight = blur(known, radius)
        colour = np.stack([blur(image[..., c] * known, radius) for c in range(3)], -1) / np.maximum(weight, 1e-6)[..., None]
        take = (filled == 0) & (weight > 0.15)
        out[take] = colour[take]
        filled[take] = 1
    out[filled == 0] = image[filled == 0]
    return out


def seam(cost):
    """The cheapest path from top to bottom through a cost grid, one column per row, moving at most one
    column a row: where two pictures laid over each other differ least (image quilting)."""
    h, w = cost.shape
    total = cost.copy()
    for y in range(1, h):
        prev = total[y - 1]
        total[y] += np.minimum(prev, np.minimum(np.r_[np.inf, prev[:-1]], np.r_[prev[1:], np.inf]))
    path = np.zeros(h, dtype=int)
    path[-1] = int(np.argmin(total[-1]))
    for y in range(h - 2, -1, -1):
        x = path[y + 1]
        lo, hi = max(0, x - 1), min(w, x + 2)
        path[y] = lo + int(np.argmin(total[y, lo:hi]))
    return path


def sky_plate(photo, land):
    """The sky, past the picture's sides and behind the land, from copies of the sky itself.

    The photograph is never changed: everything it shows stays as it is, so the still picture and the
    first frame agree. Past each side, the sky starts as the photograph's edge seen in a mirror (so it
    continues without a break) and gives way, along the seam where the two differ least, to a copy of
    sky from further in. Behind the land, the copy grows out of the colour at the land's edge. Each
    copy takes on the broad light of where it lands, since the light changes across the sky."""
    sky_rows = round(HORIZON * photo.shape[0])
    img = photo[:sky_rows].copy()
    # The photograph's outermost column is black and the next few carry a halo: a fifth of a percent of
    # its width at each side, which living-coast.ts also treats as off the picture.
    img[:, :5], img[:, -5:] = img[:, 5:6], img[:, -6:-5]
    known = ~land[:sky_rows]
    h, w = known.shape
    pad = round(REACH * w)
    cols = np.arange(w)
    lowpass = lambda a, r: np.stack([blur(a[..., c], r) for c in range(3)], -1)
    edge = fill_inward(img, known.astype(np.float32))
    # How deep each unknown pixel lies behind the land's edge: 0 at the edge, 1 a few dozen pixels in.
    depth = np.clip((0.5 - blur(known.astype(np.float32), 16)) / 0.5, 0, 1)[..., None]
    out = np.zeros((h, w + 2 * pad, 3), dtype=np.float32)
    out[:, pad:pad + w] = img

    for side in ('left', 'right'):
        sign = 1 if side == 'left' else -1
        # The sideways shift, chosen where the copy matches the sky near this side best. It is kept
        # within the open sky between the headlands, so every row it copies is real sky.
        near_side = cols[: round(0.06 * w)] if side == 'left' else cols[w - round(0.06 * w):]
        rows = slice(0, round(0.42 * photo.shape[0]))  # above the land; below it, the land hides all this
        shifts = range(round(0.33 * w), round(0.45 * w), 6)
        shift = sign * min(shifts, key=lambda d: np.abs(img[rows][:, near_side] - img[rows][:, near_side + sign * d]).mean())
        copy = lambda x: img[:, np.clip(x + shift, 0, w - 1)]
        inside = copy(cols)

        # Past the side: the mirror near the edge, the copy beyond, joined along the cheapest seam.
        outside = np.arange(-pad, 0) if side == 'left' else np.arange(w, w + pad)
        mirror = img[:, -outside if side == 'left' else 2 * (w - 1) - outside]
        far = copy(outside)
        far = far + lowpass(mirror - far, 48)  # the copy, in the light of the edge it continues
        step_out = np.abs(outside - (0 if side == 'left' else w - 1))  # 1 at the edge, pad at the far end
        path = seam(np.abs(mirror - far).sum(-1) + 4.0 * (step_out > pad // 2))  # mirror for half at most
        for y in range(h):
            t = np.clip((step_out - step_out[path[y]] + 8) / 16, 0, 1)[:, None]  # 0 mirror, 1 copy
            out[y, outside + pad] = mirror[y] * (1 - t) + far[y] * t

        # Behind the land on this side: the copy, growing out of the colour at the land's edge.
        half = (cols < w // 2) if side == 'left' else (cols >= w // 2)
        hidden = ~known & half[None, :]
        grown = edge * (1 - depth) + (inside + lowpass(edge - inside, 40)) * depth
        out[:, pad:pad + w][hidden] = grown[hidden]
    return out


def main():
    photo = Image.open(os.path.join(PHOTOS, 'dusk.jpg')).convert('RGB')
    work = photo.resize(WORK, Image.LANCZOS)
    w, h = WORK
    lum = np.asarray(work.convert('L').filter(ImageFilter.GaussianBlur(1)), dtype=np.float32) / 255
    horizon = round(HORIZON * h)

    # Open air: the light parts reachable from the top of the sky or from the middle of the sea.
    light = np.where(lum > BRIGHT, 255, 0).astype(np.uint8)
    air = flood(light, [(x, 0) for x in range(0, w, 40)] + [(int(w * 0.55), int(h * 0.62))])
    # Land: whatever is left that reaches the bottom edge (dark specks in the sky are not land).
    rest = np.where(air, 0, 255).astype(np.uint8)
    land = flood(rest, [(x, h - 1) for x in range(0, w, 20)] + [(w - 1, int(h * 0.6)), (0, int(h * 0.6))])
    rows = np.arange(h)[:, None]
    land &= rows > 0.4 * h  # nothing stands that high; this drops a dark seam down the photo's left edge
    # The land fades into the sky over a few pixels of lit rim, lighter than BRIGHT. It belongs to the land.
    land = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(13))) > 127
    sky = ~land & (rows < horizon)
    sea = ~land & (rows >= horizon)

    def half(mask):
        return np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize(OUT, Image.BOX), dtype=np.float32) / 255

    sea_out, sky_out = half(sea), half(sky)

    # Nearness of the land: low at the ridgelines, whole at the bottom edge; the headland on the right
    # stands further off than the rocks underfoot. Blurred wide, so the land never tears or bends.
    ow, oh = OUT
    y = (np.arange(oh)[:, None] + 0.5) / oh
    x = (np.arange(ow)[None, :] + 0.5) / ow
    smooth = lambda e0, e1, v: np.clip((v - e0) / (e1 - e0), 0, 1) ** 2 * (3 - 2 * np.clip((v - e0) / (e1 - e0), 0, 1))
    near = smooth(0.38, 1.05, y) * (1 - 0.35 * smooth(0.55, 0.85, x))
    near = np.asarray(Image.fromarray((near * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(24)), dtype=np.float32) / 255

    rgb = np.stack([sea_out, sky_out, near], axis=-1)
    Image.fromarray(np.round(rgb * 255).astype(np.uint8)).save(os.path.join(PHOTOS, 'dusk-map.webp'), lossless=True)

    # The plate: open air only, each land pixel taking the colour of the nearest sky or sea.
    small = np.asarray(photo.resize(OUT, Image.LANCZOS), dtype=np.float32)
    known = ((sea_out + sky_out) > 0.98).astype(np.float32)
    known = (blur(known, 2) > 0.999).astype(np.float32)  # a step back from the edge, clear of its dark fringe
    plate = fill_inward(small, known)
    # Only soft colour is left near the edges, so half the size is plenty.
    Image.fromarray(plate.clip(0, 255).astype(np.uint8)).resize((OUT[0] // 2, OUT[1] // 2), Image.BOX).save(os.path.join(PHOTOS, 'dusk-plate.webp'), quality=80)

    full = np.asarray(photo, dtype=np.float32)
    land_full = np.asarray(Image.fromarray((land * 255).astype(np.uint8)).resize(photo.size, Image.BILINEAR)) > 127
    sky = sky_plate(full, land_full)
    Image.fromarray(sky.clip(0, 255).astype(np.uint8)).save(os.path.join(PHOTOS, 'dusk-sky.webp'), quality=82)


if __name__ == '__main__':
    main()
