// What a pin on the campus map shows, worked out as the app does it (neoQuad-ios 5d968ad,
// Features/Map/CampusMap.swift): events that fall in one cell of the map's grid share a pin
// (PinClusterer), standing on their mean coordinate; the soonest one gives the pin its picture,
// and any member being live, going or offering food sets the ring and the badges (EventPin).
import type { ImageMetadata } from 'astro';
import type { SymbolName } from '../../icons/symbols';
import { categories, fillOf, isLive, photo, type SampleEvent } from './sample';

export interface Pin {
  lat: number;
  lng: number;
  /** The first event's picture; without one, its category's symbol on its colour. */
  photo?: ImageMetadata;
  symbol: SymbolName;
  fill: string;
  /** How many events share it; the badge shows when there is more than one. */
  count: number;
  live: boolean;
  going: boolean;
  /** Free food later on (the food badge), or right now (the LIVE tag instead). */
  food: boolean;
  foodLive: boolean;
}

/** The pin for events that share a spot, at a moment (minutes from the sample's now). */
export function pinOf(members: SampleEvent[], at = 0): Pin {
  const sorted = [...members].sort((a, b) => a.start - b.start);
  const first = sorted[0];
  return {
    lat: mean(sorted.map((x) => x.at.lat)),
    lng: mean(sorted.map((x) => x.at.lng)),
    photo: first.image ? photo(first.image) : undefined,
    symbol: categories[first.category].symbol,
    fill: fillOf(first),
    count: sorted.length,
    live: sorted.some((x) => isLive(x, at)),
    going: sorted.some((x) => x.going),
    food: sorted.some((x) => x.food),
    foodLive: sorted.some((x) => x.food && isLive(x, at)),
  };
}

/** The grid's cell at the launch zoom, in degrees: campus framed above the half sheet. */
export const launchCell = 0.0016;

/** The map's pins: one per grid cell, north to south (so southern pins draw on top). */
export function pins(events: SampleEvent[], cell = launchCell, at = 0): Pin[] {
  const groups = new Map<string, SampleEvent[]>();
  for (const x of events) {
    const key = `${Math.floor(x.at.lat / cell)}_${Math.floor(x.at.lng / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  return [...groups.values()].map((members) => pinOf(members, at)).sort((a, b) => b.lat - a.lat);
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
