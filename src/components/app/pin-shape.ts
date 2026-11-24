// The shape of EventPin (neoQuad-ios 5d968ad, Features/Map/CampusMap.swift), in points, in its own
// 45 x 51 pt box with the point at the bottom middle: the drawing (app/EventPin) and the ground it
// covers (what a hairline map leaves out under it, so its lines do not show through a pin).
import type { Pin } from './pin';

export const box = { width: 45, height: 51 };

/** PinShape: the 40 pt picture and its 2.5 pt ring, leaving the circle 35 degrees either side of
 *  straight down for a 6 pt rounded point. */
export const shape = 'M9.59 40.93A22.5 22.5 0 1 1 35.41 40.93Q28.31 46.47 22.5 51Q16.69 46.47 9.59 40.93Z';

/** The ring alone: the shape less the picture (fill it even-odd). */
export const ring = `${shape}M42.5 22.5A20 20 0 1 0 2.5 22.5A20 20 0 1 0 42.5 22.5Z`;

const capsule = (x: number, y: number, w: number, h: number) => {
  const r = h / 2;
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
};
const disc = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

/** The corner badges, where EventPin's overlays put them (18 pt): the count or going at the top
 *  right, free food later at the bottom left. */
export function marks(pin: Pin) {
  const parts: string[] = [];
  if (pin.count > 1) {
    const w = Math.max(18, 10 + String(pin.count).length * 6.5);
    parts.push(capsule(box.width + 6 - w, -5, w, 18));
  } else if (pin.going) parts.push(disc(box.width + 5 - 9, 4, 9));
  if (pin.food && !pin.foodLive) parts.push(disc(4, box.height - 4 - 9, 9));
  return parts.join('');
}

/** The LIVE tag over the top (18 pt tall, about 46 pt wide), drawn last, over the corner badges. */
export const tag = (pin: Pin) => (pin.foodLive ? capsule(box.width / 2 - 23, -12, 46, 18) : '');

/** Everything drawn over the picture. */
export const badges = (pin: Pin) => marks(pin) + tag(pin);

/** Everything the pin draws, badges included: where whatever lies under it is hidden. */
export const footprint = (pin: Pin) => shape + badges(pin);

/** How far a pin draws outside its box (the LIVE tag, 12 pt up), with room to spare. */
export const reach = 14;

/** A mask image for a pin's box grown by `reach` on every side: opaque but for the holes, each a
 *  path in pin points moved by (dx, dy). For glass pins, which would otherwise show what they cover. */
export function cutout(holes: { d: string; dx?: number; dy?: number }[]) {
  const [x, y, w, h] = [-reach, -reach, box.width + 2 * reach, box.height + 2 * reach];
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="none">` +
    `<mask id="m"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff"/>` +
    holes.map(({ d, dx = 0, dy = 0 }) => `<path d="${d}" transform="translate(${+dx.toFixed(2)} ${+dy.toFixed(2)})"/>`).join('') +
    `</mask><rect x="${x}" y="${y}" width="${w}" height="${h}" mask="url(#m)"/></svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
}
