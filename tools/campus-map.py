"""Draw the SBCC campus as an outline for the phone on the Students hero (read by AppWireframe.astro).

    python3 tools/campus-map.py [path/to/SBCCBuildings.swift]

Sources : the app's places, Features/Map/SBCCBuildings.swift in the iOS repo (where each pin sits)
          OpenStreetMap, through the Overpass API (building footprints, walkways, streets, the
          coastline and bluff). The app's places are themselves interior points of these OSM
          footprints (see the header of SBCCBuildings.swift), so the pins and the outline agree.
          Map data (c) OpenStreetMap contributors, ODbL.
Output  : src/data/campus-map.json  paths in the phone's own box (100 wide, cqw), north up as the app's
          campus camera is (heading 0), and where each pin's place lands in that box.

Only campus is kept: footprints and walkways within reach of one of the app's places, the streets
that bound it (Cliff Drive, Loma Alta, Shoreline), and the shore. Lines are simplified to under two
metres and written as relative moves, so the file stays small.
"""
import json
import math
import os
import re
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SWIFT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    ROOT, '..', '07 Code Snapshots', 'neoQuad-ios-main', 'Features', 'Map', 'SBCCBuildings.swift')
OUT = os.path.join(ROOT, 'src', 'data', 'campus-map.json')

# The phone's box: 100 wide, as tall as an iPhone 16 Pro is for that width (GlassPhone's aspect).
BOX_W, BOX_H = 100, 100 * 1496 / 715
# Where campus sits in it, and how big: this point lands at (CENTRE_X, CENTRE_Y), and METRES_PER_UNIT
# metres fill one unit (one cqw). The app's places are framed between the app icon and the hero's cut.
CENTRE = (34.40525, -119.69850)
CENTRE_X, CENTRE_Y = 50, 94
METRES_PER_UNIT = 8.6
REACH = 110       # metres from one of the app's places that still counts as campus
TOLERANCE = 0.2   # simplification, in units (under two metres)
PINS = {'Overlook': 'CalderOverlook', 'Pride': 'PrideCenter', 'Garden': 'PermacultureGarden'}

BBOX = '34.3990,-119.7070,34.4110,-119.6910'
QUERY = f"""[out:json][timeout:60];(
way["building"]({BBOX});
way["highway"~"footway|pedestrian|path|cycleway|secondary|tertiary"]({BBOX});
way["natural"~"coastline|cliff"]({BBOX});
);out geom;"""


def places(path):
    pattern = re.compile(r'Building\(id: "([^"]+)".*?latitude: ([\d.-]+), longitude: ([\d.-]+)')
    with open(path) as f:
        return {m[1]: (float(m[2]), float(m[3])) for m in pattern.finditer(f.read())}


def project(lat, lon):
    x = (lon - CENTRE[1]) * 111320 * math.cos(math.radians(CENTRE[0])) / METRES_PER_UNIT + CENTRE_X
    y = (CENTRE[0] - lat) * 110574 / METRES_PER_UNIT + CENTRE_Y
    return x, y


def metres(a, b):
    return math.hypot((a[0] - b[0]) * 110574, (a[1] - b[1]) * 111320 * math.cos(math.radians(CENTRE[0])))


def simplify(points, tol):
    """Douglas-Peucker."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    far, index = 0, 0
    for i, (x, y) in enumerate(points[1:-1], 1):
        d = abs(dy * (x - x1) - dx * (y - y1)) / norm
        if d > far:
            far, index = d, i
    if far <= tol:
        return [points[0], points[-1]]
    return simplify(points[: index + 1], tol)[:-1] + simplify(points[index:], tol)


def area(points):
    return abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:] + points[:1]))) / 2


def inside(p, margin=4):
    return -margin <= p[0] <= BOX_W + margin and -margin <= p[1] <= BOX_H + margin


def path(points, closed):
    """Relative moves in tenths of a unit: short numbers, and a tenth of a cqw is finer than a pixel."""
    if closed and len(points) > 2 and points[0] == points[-1]:
        points = points[:-1]
    ticks = [(round(x * 10), round(y * 10)) for x, y in points]
    ticks = [t for i, t in enumerate(ticks) if i == 0 or t != ticks[i - 1]]

    def num(v):
        text = f'{v / 10:g}'
        return text.replace('0.', '.', 1) if text.startswith(('0.', '-0.')) else text

    def pair(dx, dy):
        b = num(dy)
        return num(dx) + ('' if b.startswith('-') else ' ') + b

    d = 'M' + pair(*ticks[0]) + 'l' + ' '.join(
        pair(b[0] - a[0], b[1] - a[1]) for a, b in zip(ticks, ticks[1:]))
    return d.replace(' -', '-') + ('z' if closed else '')


def fetch():
    """The OSM ways, from Overpass. curl, not urllib: the macOS system Python's TLS cannot reach it.
    The public server is often busy, so it retries with growing waits."""
    for attempt in range(6):
        reply = subprocess.run(
            ['curl', '-sf', '-m', '120', '-A', 'campus-outline-tool', '--data-urlencode', f'data={QUERY}',
             'https://overpass-api.de/api/interpreter'],
            capture_output=True,
        )
        if reply.returncode == 0 and reply.stdout.startswith(b'{'):
            return json.loads(reply.stdout)
        time.sleep(5 * 2**attempt)
    sys.exit('Overpass did not answer; try again later.')


def main():
    spots = places(SWIFT)
    ways = fetch()['elements']

    layers = {'buildings': [], 'walks': [], 'streets': [], 'shore': []}
    for way in ways:
        tags, geometry = way.get('tags', {}), way.get('geometry', [])
        if len(geometry) < 2:
            continue
        coords = [(g['lat'], g['lon']) for g in geometry]
        near = min(metres(c, s) for c in coords[:: max(1, len(coords) // 6)] for s in spots.values())
        if 'building' in tags:
            layer, closed, keep = 'buildings', True, near < REACH
        elif tags.get('natural') in ('coastline', 'cliff'):
            layer, closed, keep = 'shore', False, True
        elif tags.get('highway') in ('secondary', 'tertiary'):
            layer, closed, keep = 'streets', False, near < REACH * 2.5
        else:
            layer, closed, keep = 'walks', False, near < REACH
        if not keep:
            continue
        projected = [project(*c) for c in coords]
        if closed:  # a ring starts where it ends, so simplify it as two halves
            half = len(projected) // 2
            points = simplify(projected[: half + 1], TOLERANCE)[:-1] + simplify(projected[half:], TOLERANCE)
        else:
            points = simplify(projected, TOLERANCE * 2)
        if not closed:  # trim the parts of a line that run off the pane
            keep_from = next((i for i, p in enumerate(points) if inside(p)), None)
            if keep_from is None:
                continue
            keep_to = len(points) - next(i for i, p in enumerate(reversed(points)) if inside(p))
            points = points[max(0, keep_from - 1): keep_to + 1]
        elif not any(inside(p) for p in points) or area(points) < 2:  # off the pane, or a shed
            continue
        if layer == 'walks' and sum(math.dist(a, b) for a, b in zip(points, points[1:])) < 4:
            continue
        layers[layer].append(path(points, closed))

    pins = {}
    for photo, place in PINS.items():
        x, y = project(*spots[place])
        pins[photo] = {'place': place, 'x': round(x / BOX_W * 100, 2), 'y': round(y / BOX_H * 100, 2)}

    out = {
        'source': 'SBCCBuildings.swift (neoQuad iOS) for the places; OpenStreetMap contributors (ODbL) for the outline',
        'width': BOX_W,
        'height': round(BOX_H, 2),
        **{name: ''.join(ds) for name, ds in layers.items()},
        'pins': pins,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
    counts = ', '.join(f'{name} {len(ds)}' for name, ds in layers.items())
    print(f'{OUT}: {os.path.getsize(OUT)} bytes ({counts}); pins {pins}')


if __name__ == '__main__':
    main()
