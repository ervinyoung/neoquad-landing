// Where a coordinate lands on one of the campus drawings in src/data (written by
// tools/campus-map.py): the same sum the tool draws the outline with, from the frame it writes,
// in percent of the drawing's box. North is up, as the app's campus camera has it.

export interface CampusView {
  width: number;
  height: number;
  frame: { lat: number; lng: number; x: number; y: number; metres: number };
}

export function onMap(view: CampusView, { lat, lng }: { lat: number; lng: number }) {
  const { frame } = view;
  const x = ((lng - frame.lng) * 111320 * Math.cos((frame.lat * Math.PI) / 180)) / frame.metres + frame.x;
  const y = ((frame.lat - lat) * 110574) / frame.metres + frame.y;
  return { x: +((x / view.width) * 100).toFixed(2), y: +((y / view.height) * 100).toFixed(2) };
}
