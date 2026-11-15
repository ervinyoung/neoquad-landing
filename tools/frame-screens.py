"""Put the app screenshots into the silver iPhone frame, the Apple way: 9:41, full battery.

    python3 tools/frame-screens.py

Sources  : the dark-mode screens used in the brand deck (docs/screenshots in the iOS repo).
Frame    : cut from the mockup the old landing page used (legacy/assets/screen-home.png).
Output   : src/assets/app/*.png, one framed phone per screen, transparent outside the phone.
"""
import math, os, sys
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCES = os.path.join(ROOT, '..', '07 Code Snapshots', 'neoQuad-ios-REFRESH (old working copy, Oct 19)', 'docs', 'screenshots')
FRAME = os.path.join(ROOT, 'legacy', 'assets', 'screen-home.png')
OUT = os.path.join(ROOT, 'src', 'assets', 'app')
FONT = '/Library/Fonts/SF-Pro-Text-Semibold.otf'
SCREENS = {'01-events': 'events', '02-places': 'places', '03-event': 'event', '04-live': 'live'}
SS = 3            # supersampling for masks
BEZEL = 21.5      # px from the outer edge of the body to the glass, measured on the frame
DEBUG = '--debug' in sys.argv


def lum(p):
    return (p[0] * 3 + p[1] * 6 + p[2]) / 10


def erode(mask, radius, steps=72):
    """Euclidean erosion of an L mask: keep a pixel only if a disc of `radius` fits inside."""
    out = mask
    for i in range(steps):
        a = 2 * math.pi * i / steps
        out = ImageChops.darker(out, ImageChops.offset(mask, round(radius * math.cos(a)), round(radius * math.sin(a))))
    return out


def frame_parts():
    frame = Image.open(FRAME).convert('RGBA')
    w, h = frame.size
    alpha = frame.split()[3]
    # The body, without the side buttons: its left and right edges are read on a row with no button.
    row = [alpha.getpixel((x, int(h * 0.75))) for x in range(w)]
    left = next(x for x, a in enumerate(row) if a > 128)
    right = w - 1 - next(x for x, a in enumerate(reversed(row)) if a > 128)
    body = alpha.copy()
    d = ImageDraw.Draw(body)
    d.rectangle((0, 0, left - 1, h), fill=0)
    d.rectangle((right + 1, 0, w, h), fill=0)
    # Pad so the erosion's wrap-around offsets never touch the body.
    pad = 40
    big = Image.new('L', ((w + 2 * pad) * SS, (h + 2 * pad) * SS), 0)
    big.paste(body.resize((w * SS, h * SS), Image.BICUBIC).point(lambda v: 255 if v > 127 else 0), (pad * SS, pad * SS))
    def inset(px):
        m = erode(big, px * SS).crop((pad * SS, pad * SS, (pad + w) * SS, (pad + h) * SS))
        return m.resize((w, h), Image.LANCZOS)
    glass = inset(BEZEL)            # where the screen shows
    hole = inset(BEZEL - 7)         # cut through the old screen, stopping inside the black bezel
    shell = frame.copy()
    shell.putalpha(ImageChops.multiply(alpha, ImageChops.invert(hole)))
    return shell, glass, hole


def screen_rect(im):
    """The glass area of a source shot: found from the bright titanium edge of its own frame."""
    w, h = im.size
    edge = lambda seq: next(i for i, p in enumerate(seq) if lum(p) > 130)
    row = [im.getpixel((x, int(h * 0.75))) for x in range(w)]
    col = [im.getpixel((w // 2, y)) for y in range(h)]
    l, r = edge(row), w - 1 - edge(row[::-1])
    t, b = edge(col), h - 1 - edge(col[::-1])
    k = 21.5  # edge of the source frame to its glass
    return (l + k, t + k, r - k + 1, b - k + 1)


# Where the clock sits on the glass, as fractions of its width and height. Measured once on the
# event screen, whose status bar is over a plain dark map; the same device took every shot.
CLOCK = None


def find_clock(screen):
    w, h = screen.size
    zone = (int(w * 0.07), int(h * 0.022), int(w * 0.31), int(h * 0.066))
    r, g, b = screen.crop(zone).split()
    box = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v > 200 else 0).getbbox()
    return ((box[0] + zone[0]) / w, (box[1] + zone[1]) / h, (box[2] + zone[0]) / w, (box[3] + zone[1]) / h)


def set_time(screen, text='9:41'):
    """Replace the clock. The old digits are lifted off the map, then the new ones are set in SF Pro."""
    w, h = screen.size
    fx0, fy0, fx1, fy1 = CLOCK
    x0, y0, x1, y1 = fx0 * w, fy0 * h, fx1 * w, fy1 * h
    mx, my = (x1 - x0) * 0.08, (y1 - y0) * 0.3
    zone = (int(x0 - mx), int(y0 - my), int(x1 + mx) + 1, int(y1 + my) + 1)
    r, g, b = screen.crop(zone).split()
    white = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 255 if v > 185 else 0)
    cap = y1 - y0
    # Lift the digits: cover them, and a soft margin around them, with the map from just below.
    grow = ImageFilter.MaxFilter(2 * round(cap * 0.22) + 1)
    cover = Image.new('L', screen.size, 0)
    cover.paste(white.filter(grow), zone[:2])
    cover = cover.filter(ImageFilter.GaussianBlur(cap * 0.07))
    drop = round(cap * 1.9)
    below = ImageChops.offset(screen, 0, -drop)
    screen = Image.composite(below, screen, cover)
    # Set the new digits, centred where the old ones were, at the same cap height.
    font = ImageFont.truetype(FONT, round(cap / 0.705 * 4))
    layer = Image.new('L', (w * 4, h * 4), 0)
    d = ImageDraw.Draw(layer)
    bx = d.textbbox((0, 0), text, font=font)
    cx, cy = (x0 + x1) / 2 * 4, (y0 + y1) / 2 * 4
    d.text((cx - (bx[0] + bx[2]) / 2, cy - (bx[1] + bx[3]) / 2), text, font=font, fill=255)
    layer = layer.resize((w, h), Image.LANCZOS)
    screen.paste((255, 255, 255), (0, 0), layer)
    return screen, (x0, y0, x1, y1)


def main():
    shell, glass, hole = frame_parts()
    gx0, gy0, gx1, gy1 = glass.point(lambda v: 255 if v > 127 else 0).getbbox()
    gw, gh = gx1 - gx0, gy1 - gy0
    print('frame', shell.size, 'glass', (gx0, gy0, gx1, gy1), 'ratio %.4f' % (gh / gw))
    global CLOCK
    ref = Image.open(os.path.join(SOURCES, '03-event.jpg')).convert('RGB')
    CLOCK = find_clock(ref.resize((gw, gh), Image.LANCZOS, box=screen_rect(ref)))
    print('clock', tuple(round(v, 4) for v in CLOCK))
    for src, name in SCREENS.items():
        im = Image.open(os.path.join(SOURCES, src + '.jpg')).convert('RGB')
        rect = screen_rect(im)
        print(' ', src, im.size, 'glass', tuple(round(v, 1) for v in rect), 'ratio %.4f' % ((rect[3] - rect[1]) / (rect[2] - rect[0])))
        screen = im.resize((gw, gh), Image.LANCZOS, box=rect)
        screen = screen.filter(ImageFilter.UnsharpMask(radius=1.2, percent=45, threshold=2))
        screen, box = set_time(screen)
        phone = Image.new('RGBA', shell.size, (0, 0, 0, 0))
        phone.paste((0, 0, 0, 255), (0, 0), hole)
        full = Image.new('RGB', shell.size, (0, 0, 0))
        full.paste(screen, (gx0, gy0))
        phone.paste(full, (0, 0), glass)
        phone.alpha_composite(shell)
        phone.save(os.path.join(OUT, f'screen-{name}.png'))
        if DEBUG:
            phone.crop((0, 0, shell.size[0], 190)).resize((shell.size[0] * 2, 380), Image.LANCZOS).save(f'/tmp/_dbg-{name}.png')


if __name__ == '__main__':
    main()
