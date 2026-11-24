// The app's demo campus (neoQuad-ios 5d968ad, Demo/SampleCampus.swift), the one source for every
// event, place and time the site shows: the hero phone's map and Happening Now, and How it works.
// The demo is built around "now"; here now is a Monday at 12:35 PM, so Club Rush (started an hour
// ago, three hours long) runs until 2:35 PM. Times are minutes from now, written the way the Swift
// writes them (rel, day, next). Only events the map can show are listed (live, or within its 45-day
// horizon, MapEventHorizon.swift), a weekly or monthly series by its next meeting.
import type { ImageMetadata } from 'astro';
import type { SymbolName } from '../../icons/symbols';
import campusCenter from '../../assets/app/photos/campus-center.jpg';
import library from '../../assets/app/photos/library.jpg';
import meadow from '../../assets/app/photos/meadow.jpg';

// ---------- Categories (Event.swift: EventCategory.icon; Palette.swift: EventCategory.brand) ----------

export type Category =
  | 'academic' | 'social' | 'sportsRec' | 'artsCulture' | 'wellness'
  | 'career' | 'clubMeeting' | 'food' | 'communityService' | 'other';

/** Each palette family's fill, the colour an event without a picture is drawn in (BrandFamily). */
const family = {
  coastal: '#3680DD', navy: '#335AA6', orchid: '#A55FB9', violet: '#7756C0', terracotta: '#C85C2E',
  sunlit: '#CC7200', gold: '#B28324', green: '#169152', teal: '#008E89', brick: '#B24745',
};

export const categories: Record<Category, { symbol: SymbolName; fill: string }> = {
  academic: { symbol: 'graduationcap.fill', fill: family.coastal },
  social: { symbol: 'party.popper.fill', fill: family.orchid },
  sportsRec: { symbol: 'figure.run', fill: family.green },
  artsCulture: { symbol: 'paintpalette.fill', fill: family.terracotta },
  wellness: { symbol: 'heart.fill', fill: family.teal },
  career: { symbol: 'briefcase.fill', fill: family.navy },
  clubMeeting: { symbol: 'person.3.fill', fill: family.violet },
  food: { symbol: 'fork.knife', fill: family.sunlit },
  communityService: { symbol: 'hands.sparkles.fill', fill: family.gold },
  other: { symbol: 'sparkles', fill: family.coastal },
};

/** "Other" takes a family by its org's name, so each org keeps one colour (Event.brand). */
const rotation = [family.coastal, family.orchid, family.terracotta, family.teal, family.violet, family.sunlit, family.green, family.navy];
function orgFill(org: string) {
  let hash = 5381n;
  for (const ch of org) hash = BigInt.asIntN(64, hash * 33n + BigInt(ch.codePointAt(0)!));
  const n = BigInt(rotation.length);
  return rotation[Number(((hash % n) + n) % n)];
}

// ---------- Places (SampleCampus.Spot): where an event's pin stands ----------

export interface Spot {
  name: string;
  lat: number;
  lng: number;
}

const spot = (name: string, lat: number, lng: number): Spot => ({ name, lat, lng });
export const spots = {
  plaza: spot('Friendship Plaza', 34.4063, -119.69719),
  library: spot('Luria Library', 34.40421, -119.70028),
  dramaMusic: spot('Drama/Music', 34.40309, -119.70142),
  studentServices: spot('Student Services', 34.40674, -119.69803),
  calder: spot('Calder Overlook', 34.40413, -119.69897),
  campusCenter: spot('Campus Center', 34.40613, -119.69676),
  careerServices: spot('Career Services', 34.40541, -119.69711),
  westWalk: spot('West Campus Walk Way', 34.4037, -119.7018),
  garvin: spot('Garvin Theatre', 34.40326, -119.70156),
  leadbetter: spot('Leadbetter Beach', 34.40268, -119.69985),
  pershing: spot('Pershing Park', 34.40871, -119.69629),
  earthBio: spot('Earth & Biological Sciences', 34.40559, -119.69767),
  businessComm: spot('Business Communications', 34.40408, -119.70201),
  idc: spot('Interdisciplinary Center', 34.40426, -119.70095),
  pavilion: spot('Sports Pavilion', 34.40482, -119.69824),
  physSci: spot('Physical Science', 34.40601, -119.69787),
  humanities: spot('Humanities', 34.40679, -119.69611),
  garden: spot('Permaculture Garden', 34.40388, -119.70115),
};

// ---------- Pictures (the asset catalogue's BuildingPhoto_*), as far as the site shows them ----------

const photos: Record<string, ImageMetadata> = {
  BuildingPhoto_CC: campusCenter,
  BuildingPhoto_L: library,
  BuildingPhoto_Meadow: meadow,
};

/** An event's picture. One the site shows has to be exported to src/assets/app/photos first. */
export function photo(image: string): ImageMetadata {
  const found = photos[image];
  if (!found) throw new Error(`${image} is shown but not in src/assets/app/photos (see app/sample.ts)`);
  return found;
}

// ---------- Time ----------

/** Now, in minutes after midnight, and today's weekday (1 = Sunday … 7 = Saturday, as Calendar). */
export const now = 12 * 60 + 35;
const weekday = 2;

const rel = (minutes: number) => minutes;
const day = (offset: number, hour: number, minute = 0) => offset * 1440 + hour * 60 + minute - now;
/** The next given weekday, strictly after today. */
const next = (target: number, hour: number, minute = 0, weeksLater = 0) =>
  day(((target - weekday + 7) % 7 || 7) + weeksLater * 7, hour, minute);

/** A time of day as the app writes it: "2:35 PM". Takes minutes from now. */
export function clock(fromNow: number) {
  const of = (((now + fromNow) % 1440) + 1440) % 1440;
  const h = Math.floor(of / 60);
  return `${h % 12 || 12}:${String(of % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---------- Events ----------

export interface SampleEvent {
  id: string;
  title: string;
  org: string;
  category: Category;
  at: Spot;
  /** Minutes from now, and how long it runs. */
  start: number;
  minutes: number;
  /** Its picture, by asset name; without one the app draws its category. */
  image?: string;
  food?: boolean;
  /** The demo student is going (SampleCampus: going). */
  going?: boolean;
  description?: string;
}

const e = (event: SampleEvent) => event;

export const events: SampleEvent[] = [
  // Happening now
  e({ id: 'club_rush', title: 'Club Rush', org: 'Student Life', category: 'social', at: spots.plaza, start: rel(-60), minutes: 180, image: 'BuildingPhoto_CC', food: true,
      description: 'Meet 60+ clubs in one afternoon. Grab a free taco, spin the prize wheel, and sign up for anything that looks fun. Clubs are grouped by interest, so wander.' }),
  e({ id: 'study_jam', title: 'Study Jam: Midterm Edition', org: 'The Well', category: 'academic', at: spots.library, start: rel(-30), minutes: 180, image: 'BuildingPhoto_L', food: true }),
  e({ id: 'open_studio', title: 'Open Studio Night', org: 'Ceramics Collective', category: 'artsCulture', at: spots.dramaMusic, start: rel(-15), minutes: 120 }),
  // Later today (Transfer Q&A is online only, so it has no pin)
  e({ id: 'fafsa_workshop', title: 'FAFSA & Dream Act Workshop', org: 'Financial Aid', category: 'academic', at: spots.studentServices, start: rel(40), minutes: 60, going: true }),
  e({ id: 'sunset_walk', title: 'Sunset Photo Walk', org: 'Photography Club', category: 'artsCulture', at: spots.calder, start: rel(130), minutes: 90, image: 'BuildingPhoto_Meadow' }),
  e({ id: 'smash_tourney', title: 'Smash Bros Tournament', org: 'Esports Club', category: 'social', at: spots.campusCenter, start: rel(200), minutes: 180, food: true }),
  // Tomorrow
  e({ id: 'resume_lab', title: 'Resume Lab', org: 'Career Center', category: 'career', at: spots.careerServices, start: day(1, 10), minutes: 90 }),
  e({ id: 'ptk_bake_sale', title: 'PTK Bake Sale', org: 'Phi Theta Kappa', category: 'other', at: spots.westWalk, start: day(1, 11), minutes: 120, food: true }),
  e({ id: 'film_spirited_away', title: 'Film Night: Spirited Away', org: 'Film Society', category: 'artsCulture', at: spots.garvin, start: day(1, 19), minutes: 135, image: 'BuildingPhoto_GT', food: true, going: true }),
  // This week and next
  e({ id: 'surf_session', title: 'Sunrise Surf Session', org: 'Surf Club', category: 'sportsRec', at: spots.leadbetter, start: next(7, 7), minutes: 120, going: true }),
  e({ id: 'inspiration_hike', title: 'Front Country Hike: Inspiration Point', org: 'Hiking Club', category: 'sportsRec', at: spots.pershing, start: next(1, 8), minutes: 240 }),
  e({ id: 'nap_tea', title: 'Nap Pods & Tea', org: 'The Well', category: 'wellness', at: spots.campusCenter, start: next(6, 11), minutes: 180 }),
  e({ id: 'uc_piq', title: 'UC Personal Insight Questions', org: 'Transfer Center', category: 'academic', at: spots.studentServices, start: next(2, 12, 30), minutes: 60 }),
  e({ id: 'er_nurse_talk', title: 'Speaker: Life as an ER Nurse', org: 'Pre-Health Society', category: 'career', at: spots.earthBio, start: next(3, 17), minutes: 75 }),
  e({ id: 'accommodations_101', title: 'Accommodations 101', org: 'DSPS', category: 'academic', at: spots.studentServices, start: next(3, 11), minutes: 60 }),
  e({ id: 'potluck_poetry', title: 'Potluck & Poetry', org: 'Black Student Union', category: 'social', at: spots.campusCenter, start: day(7, 18), minutes: 150, image: 'BuildingPhoto_CC', food: true }),
  e({ id: 'valorant_scrims', title: 'Valorant Scrims', org: 'Esports Club', category: 'sportsRec', at: spots.businessComm, start: next(6, 18), minutes: 180 }),
  e({ id: 'ptk_scholarships', title: 'Scholarship Night', org: 'Phi Theta Kappa', category: 'academic', at: spots.idc, start: next(4, 17, 30, 1), minutes: 90, image: 'BuildingPhoto_IDC' }),
  e({ id: 'career_fair', title: 'Fall Job & Internship Fair', org: 'Career Center', category: 'career', at: spots.pavilion, start: day(12, 10), minutes: 240, image: 'BuildingPhoto_Stadium' }),
  e({ id: 'arduino_intro', title: 'Intro to Arduino', org: 'Robotics Club', category: 'academic', at: spots.physSci, start: next(7, 13, 0, 1), minutes: 120 }),
  e({ id: 'altar_building', title: 'Día de los Muertos Altar Building', org: 'Student Life', category: 'artsCulture', at: spots.campusCenter, start: day(33, 12), minutes: 240 }),
  // Series, by their next meeting
  e({ id: 'robotics_build_0', title: 'Robotics Build Night', org: 'Robotics Club', category: 'clubMeeting', at: spots.physSci, start: next(4, 16), minutes: 120, going: true }),
  e({ id: 'photo_meeting_0', title: 'Photography Club Meeting', org: 'Photography Club', category: 'clubMeeting', at: spots.humanities, start: next(3, 15), minutes: 60 }),
  e({ id: 'asg_meeting_0', title: 'ASG Open Meeting', org: 'Associated Student Government', category: 'clubMeeting', at: spots.campusCenter, start: next(2, 14), minutes: 90 }),
  e({ id: 'garden_day_0', title: 'Permaculture Garden Day', org: 'Environmental Action Club', category: 'communityService', at: spots.garden, start: next(7, 10), minutes: 180 }),
];

export function event(id: string): SampleEvent {
  const found = events.find((x) => x.id === id);
  if (!found) throw new Error(`No sample event ${id}`);
  return found;
}

/** Live at a moment (minutes from now): it has started and not ended. */
export const isLive = (x: SampleEvent, at = 0) => x.start <= at && at <= x.start + x.minutes;

/** The colour the app draws an event in when it has no picture (Event.brand). */
export const fillOf = (x: SampleEvent) => (x.category === 'other' ? orgFill(x.org) : categories[x.category].fill);

/** Happening Now, in the order the card lists it: by start. */
export const happeningNow = events.filter((x) => isLive(x)).sort((a, b) => a.start - b.start);
