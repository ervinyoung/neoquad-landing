// The one event How it works follows, from the app's demo campus (app/sample.ts), and the moment
// its scenes show: Club Rush, eight minutes before it starts, when the tracker says to walk over.
// In the hero, later the same day, it is on and Happening Now.
import { event } from '../app/sample';

export const clubRush = event('club_rush');

/** Minutes from the sample's now. */
export const moment = clubRush.start - 8;
