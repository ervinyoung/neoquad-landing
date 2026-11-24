"""Draw SBCC in hairlines for every map on the site, from one fetch, in one run.

    python3 tools/campus-map.py [path/to/SBCCBuildings.swift]

Sources : the app's places, neoQuad/Backend/Data/SBCCBuildings.swift in the iOS repo at the commit
          the site is drawn from (tools/app_source.py), or the file given
          OpenStreetMap, through the Overpass API (building footprints, walkways, streets, the
          coastline and bluff). The app's places are themselves interior points of these OSM
          footprints (see the header of SBCCBuildings.swift), so the places and the outline agree.
          Map data (c) OpenStreetMap contributors, ODbL.
Output  : one JSON file per view in VIEWS: paths in the view's own box (100 wide, so one unit is a
          cqw of whatever shows it), north up as the app's campus camera is (heading 0), and the
          view's frame, from which src/components/app/map.ts puts any coordinate (an event's pin)
          on it. Each view is a frame only: the drawing is the same everywhere, so maps never
          disagree.

Only campus is kept: footprints and walkways within reach of one of the app's places, the streets
that bound it (Cliff Drive, Loma Alta, Shoreline), and the shore. Lines are simplified to under two
metres at the hero's scale and written as relative moves, so the files stay small.
"""
import json
import math
import os
import re
import subprocess
import sys
import time

import app_source

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLACES = 'neoQuad/Backend/Data/SBCCBuildings.swift'
DATA = os.path.join(ROOT, 'src', 'data')

# The views. Each is a box 100 wide and `height` tall; `centre` lands at (x, y) in it, and
# `metres` metres fill one unit (one cqw of what shows it).
VIEWS = {
    # The phone on the Students hero (app/HomeMap), and the dashboard's map tile on /schools
    # (DashboardOutline), which shows a band of it. As tall as an iPhone 16 Pro is for its width
    # (GlassPhone's aspect); campus framed as the app frames it at launch, in the map left between
    # the status bar and the Events sheet at its resting height (its top is 113.5 units down):
    # fitted to the pins in the app's render (src/assets/app/screen-events.png), within half a unit.
    'campus-map': {'height': 100 * 1496 / 715, 'centre': (34.40525, -119.69850), 'x': 50.2, 'y': 67.7, 'metres': 9.65},
    # The map in How it works (how/MapScene): a 340 x 400 pt piece of the app's map at one metre to
    # the point, Friendship Plaza (SBCCBuildings.swift, FriendshipPlaza) a little below the middle.
    'campus-plaza': {'height': 100 * 400 / 340, 'centre': (34.406211, -119.697185), 'x': 50, 'y': 100 * 400 / 340 * 0.55,
                     'metres': 340 / 100},
}
REACH = 110       # metres from one of the app's places that still counts as campus
TOLERANCE = 0.2   # simplification, in each view's units (about two metres on the hero's)

BBOX = '34.3990,-119.7070,34.4110,-119.6910'
QUERY = f"""[out:json][timeout:60];(
way["building"]({BBOX});
way["highway"~"footway|pedestrian|path|cycleway|secondary|tertiary"]({BBOX});
way["natural"~"coastline|cliff"]({BBOX});
);out geom;"""


def places():
    """The app's places: the file given on the command line, else SBCCBuildings.swift at the site's commit."""
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            text = f.read()
    else:
        text = app_source.read(PLACES).decode()
    pattern = re.compile(r'Building\(id: "([^"]+)".*?latitude: ([\d.-]+), longitude: ([\d.-]+)')
    return {m[1]: (float(m[2]), float(m[3])) for m in pattern.finditer(text)}


class View:
    """A frame on campus: where a coordinate lands in the box. src/components/app/map.ts does the
    same sum from the frame written out, so a pin and the outline under it always agree."""

    def __init__(self, name, height, centre, x, y, metres):
        self.name, self.width, self.height = name, 100, height
        self.centre, self.x, self.y, self.metres = centre, x, y, metres

    def project(self, lat, lon):
        x = (lon - self.centre[1]) * 111320 * math.cos(math.radians(self.centre[0])) / self.metres + self.x
        y = (self.centre[0] - lat) * 110574 / self.metres + self.y
        return x, y

    def distance(self, a, b):
        """Metres between two coordinates."""
        return math.hypot((a[0] - b[0]) * 110574, (a[1] - b[1]) * 111320 * math.cos(math.radians(self.centre[0])))

    def inside(self, p, margin=4):
        return -margin <= p[0] <= self.width + margin and -margin <= p[1] <= self.height + margin

    def frame(self):
        return {'lat': self.centre[0], 'lng': self.centre[1], 'x': round(self.x, 4), 'y': round(self.y, 4),
                'metres': round(self.metres, 4)}


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


def draw(view, ways, spots):
    """The outline in this view's box, layer by layer. Thresholds are in the view's own units."""
    layers = {'buildings': [], 'walks': [], 'streets': [], 'shore': []}
    for way in ways:
        tags, geometry = way.get('tags', {}), way.get('geometry', [])
        if len(geometry) < 2:
            continue
        coords = [(g['lat'], g['lon']) for g in geometry]
        near = min(view.distance(c, s) for c in coords[:: max(1, len(coords) // 6)] for s in spots.values())
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
        projected = [view.project(*c) for c in coords]
        if closed:  # a ring starts where it ends, so simplify it as two halves
            half = len(projected) // 2
            points = simplify(projected[: half + 1], TOLERANCE)[:-1] + simplify(projected[half:], TOLERANCE)
        else:
            points = simplify(projected, TOLERANCE * 2)
        if not closed:  # trim the parts of a line that run off the box
            keep_from = next((i for i, p in enumerate(points) if view.inside(p)), None)
            if keep_from is None:
                continue
            keep_to = len(points) - next(i for i, p in enumerate(reversed(points)) if view.inside(p))
            points = points[max(0, keep_from - 1): keep_to + 1]
        elif not any(view.inside(p) for p in points) or area(points) < 2:  # off the box, or a shed
            continue
        if layer == 'walks' and sum(math.dist(a, b) for a, b in zip(points, points[1:])) < 4:
            continue
        layers[layer].append(path(points, closed))
    return layers


def main():
    spots = places()
    ways = fetch()['elements']
    os.makedirs(DATA, exist_ok=True)
    for name, spec in VIEWS.items():
        view = View(name, spec['height'], spec['centre'], spec['x'], spec['y'], spec['metres'])
        layers = draw(view, ways, spots)
        out = {
            'source': 'SBCCBuildings.swift (neoQuad iOS) for the places; OpenStreetMap contributors (ODbL) for the outline',
            'width': view.width,
            'height': round(view.height, 2),
            'frame': view.frame(),
            **{layer: ''.join(ds) for layer, ds in layers.items()},
        }
        target = os.path.join(DATA, f'{name}.json')
        with open(target, 'w') as f:
            json.dump(out, f, separators=(',', ':'))
        counts = ', '.join(f'{layer} {len(ds)}' for layer, ds in layers.items())
        print(f'{os.path.relpath(target, ROOT)}: {os.path.getsize(target)} bytes ({counts})')


if __name__ == '__main__':
    main()
