// Sample figures for the staff dashboard mock on /schools: one healthy fall week on a campus.
// Every number shown is either set here or derived here, so the screens always agree:
// involved + not involved = verified, percentages come from the counts, and each
// comparison is worked out from this week and the week before.

// A placeholder mailbox on a domain reserved for examples (RFC 2606), never a real address.
export const account = { email: 'studentlife@example.edu' };
export const initials = account.email.slice(0, 2).toUpperCase();

export const range = { from: 'Oct 13, 2026', to: 'Oct 19, 2026' };

const week = {
  verified: 3184,
  involved: 1026, // verified students with at least one sign-up
  rsvps: 1388,
  uniquePeople: 1071, // anyone who RSVPed, verified or not, so never below `involved`
  firstTimeRsvps: 236,
  views: 12940,
  events: 16, // matches the week of Oct 13 on the Events calendar
};

const before = { verified: 3140, involved: 915, rsvps: 1203, firstTimeRsvps: 197, views: 11180, events: 13 };

const count = (n: number) => n.toLocaleString('en-US');
const share = (part: number, whole: number) => `${Math.round((part / whole) * 100)}%`;

/** A change against the previous seven days, green when it is good news. */
export interface Change {
  text: string;
  good: boolean;
}

const change = (now: number, then: number, goodWhen: 'up' | 'down' = 'up'): Change => {
  const pct = Math.round(((now - then) / then) * 100);
  return {
    text: `${pct > 0 ? '+' : ''}${pct}% vs the previous 7 days`,
    good: goodWhen === 'up' ? pct >= 0 : pct <= 0,
  };
};

const notInvolved = week.verified - week.involved;

export const metrics = {
  involved: { value: count(week.involved), change: change(week.involved, before.involved) },
  notInvolved: {
    value: count(notInvolved),
    change: change(notInvolved, before.verified - before.involved, 'down'),
  },
  rsvps: { value: count(week.rsvps), change: change(week.rsvps, before.rsvps) },
  firstTimeRsvps: { value: count(week.firstTimeRsvps), change: change(week.firstTimeRsvps, before.firstTimeRsvps) },
  views: { value: count(week.views), change: change(week.views, before.views) },
  events: { value: count(week.events), change: change(week.events, before.events) },
};

export const snapshot = [
  {
    icon: 'user',
    title: 'Students involved',
    text: 'Verified students with at least one event sign-up in this period.',
    value: metrics.involved.value,
    detail: `${share(week.involved, week.verified)} of ${count(week.verified)} verified students`,
    change: metrics.involved.change,
  },
  {
    icon: 'alert',
    title: 'Not involved',
    text: 'Verified students with zero sign-ups — the outreach bucket.',
    value: metrics.notInvolved.value,
    detail: `${share(notInvolved, week.verified)} with no sign-ups this period`,
    change: metrics.notInvolved.change,
  },
  {
    icon: 'ticket',
    title: 'RSVPs',
    text: 'Students who said they are going to an event in this period.',
    value: metrics.rsvps.value,
    detail: `${count(week.uniquePeople)} unique people`,
    change: metrics.rsvps.change,
  },
  {
    icon: 'star',
    title: 'First-timers',
    text: 'Share of RSVPs that are a student’s first event on neoQuad.',
    value: share(week.firstTimeRsvps, week.rsvps),
    detail: `${count(week.firstTimeRsvps)} first-time RSVPs`,
    change: metrics.firstTimeRsvps.change,
  },
];

export const comparison = [
  { label: 'RSVPs', ...metrics.rsvps },
  { label: 'Students involved', ...metrics.involved },
  { label: 'Not involved', ...metrics.notInvolved },
  { label: 'First-time RSVPs', ...metrics.firstTimeRsvps },
  { label: 'Event views', ...metrics.views },
  { label: 'Events on the calendar', ...metrics.events },
];

/** Pins on the campus map, placed in percent of the tile. `count` is the badge. */
export const pins: { x: number; y: number; kind: 'live' | 'upcoming' | 'recent'; count?: number }[] = [
  { x: 40.6, y: 41, kind: 'live', count: 86 },
  { x: 60.4, y: 15.5, kind: 'live', count: 42 },
  { x: 29.8, y: 27, kind: 'upcoming', count: 128 },
  { x: 49.2, y: 26.5, kind: 'upcoming', count: 64 },
  { x: 65.8, y: 36, kind: 'upcoming', count: 215 },
  { x: 44.5, y: 7.5, kind: 'recent' },
  { x: 24.6, y: 52, kind: 'recent' },
];

/** The Events calendar: October 2026, Sunday first. Times are 12-hour, as the staff site writes them. */
export const calendar = {
  title: 'October 2026',
  firstDay: { year: 2026, month: 8, day: 27 }, // Sunday, Sep 27 (months are zero-based)
  month: 9, // October
  events: {
    '2026-10-01': [['11am', 'Fall Welcome Fair'], ['4pm', 'Transfer Center Info Session']],
    '2026-10-02': [['12pm', 'Club Rush: Day 1'], ['6pm', 'Open Mic at the Garvin']],
    '2026-10-05': [['10am', 'FAFSA Workshop'], ['3pm', 'Study Abroad in Lisbon, Spring']],
    '2026-10-06': [['12pm', 'Club Rush: Day 2'], ['5pm', 'Women in STEM Mixer']],
    '2026-10-07': [['11am', 'Wag Well, Be Well Therapy Dogs'], ['2pm', 'Resume Lab']],
    '2026-10-08': [['1pm', 'Latinx Heritage Month Mural'], ['6pm', 'Vaqueros Football vs. Ventura']],
    '2026-10-09': [['4pm', 'Sunset Beach Cleanup']],
    '2026-10-13': [['10am', 'Midterm Study Jam'], ['12pm', 'Career Fair Prep'], ['5pm', 'Film Club: Fall Screening']],
    '2026-10-14': [['11am', 'Wag Well, Be Well Therapy Dogs'], ['1pm', 'UC Transfer Q&A'], ['6pm', 'Poetry Night']],
    '2026-10-15': [['12pm', 'Majors & Programs Fair'], ['3pm', 'LGBTQIA+ Freedom Circle'], ['7pm', 'Jazz Ensemble Concert']],
    '2026-10-16': [['2pm', 'Wellness Walk on the Bluff'], ['6pm', 'Vaqueros Volleyball Home Game']],
    '2026-10-17': [['10am', 'Farmers Market Volunteer Day']],
    '2026-10-18': [['4pm', 'Sunset Yoga on the Lawn']],
    '2026-10-19': [['11am', 'Study Abroad in Tokyo, Summer'], ['1pm', 'Financial Aid Drop-in'], ['5pm', 'Board Game Night']],
    '2026-10-21': [['12pm', 'Vision Board Workshop'], ['4pm', 'Hiking Club: Douglas Preserve']],
    '2026-10-22': [['11am', 'Student Senate Town Hall'], ['2pm', 'Resume Lab']],
    '2026-10-23': [['6pm', 'Theatre Arts: Opening Night']],
    '2026-10-26': [['10am', 'Flu Shot Clinic'], ['3pm', 'Study Abroad in Bali, Summer']],
    '2026-10-27': [['12pm', 'Black Student Union Lunch'], ['5pm', 'Robotics Club Showcase']],
    '2026-10-28': [['11am', 'Wag Well, Be Well Therapy Dogs'], ['6pm', 'Dia de los Muertos Altar']],
    '2026-10-29': [['1pm', 'Coding Club Hack Night']],
    '2026-10-30': [['5pm', 'Halloween Costume Contest']],
    '2026-11-03': [['12pm', 'Veterans Center Coffee Hour']],
    '2026-11-05': [['3pm', 'Spring Registration Help']],
  } as Record<string, [string, string][]>,
};

/** The New event form, filled in. */
export const draft = {
  title: 'Fall Career & Transfer Fair',
  organization: 'Career Center',
  date: '10/29/2026',
  starts: '12:00 PM',
  summary: 'Thursday, Oct 29 · 12:00 PM – 3:00 PM (3 hr)',
  lengths: ['30 min', '1 hr', '1.5 hr', '2 hr', '3 hr', 'Custom end'],
  length: '3 hr',
  repeats: ['One time', 'Weekly', 'Every 2 weeks', 'Monthly'],
  repeat: 'One time',
};
