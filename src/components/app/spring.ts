// SwiftUI's .spring(duration:bounce:) as a CSS easing, so a scene moves the way the app does.
// Apple's parameters: the spring's period is `duration`, its damping ratio is 1 - bounce. The curve
// is sampled until it settles (within 0.1%) and written as linear(); `ms` is how long that takes.

export interface Spring {
  easing: string;
  ms: number;
}

export function spring(duration: number, bounce: number): Spring {
  const omega = (2 * Math.PI) / duration;
  const zeta = 1 - bounce;
  const damped = omega * Math.sqrt(1 - zeta * zeta);
  const at = (t: number) =>
    zeta >= 1
      ? 1 - Math.exp(-omega * t) * (1 + omega * t)
      : 1 - Math.exp(-zeta * omega * t) * (Math.cos(damped * t) + ((zeta * omega) / damped) * Math.sin(damped * t));

  const step = 1 / 120;
  let end = step;
  // Settled: no later sample strays more than 0.1% from rest.
  for (let t = step; t < 4; t += step) {
    if (Math.abs(1 - at(t)) > 0.001) end = t + step;
  }
  const count = Math.max(24, Math.round(end / step / 2));
  const points = Array.from({ length: count + 1 }, (_, i) => +at((i / count) * end).toFixed(4));
  points[count] = 1;
  return { easing: `linear(${points.join(', ')})`, ms: Math.round(end * 1000) };
}

/** A pin on the campus map arriving, as the welcome's unlock places it (CampusMap.swift). */
export const place = spring(0.45, 0.25);

/** A pin being selected. */
export const lift = spring(0.3, 0.15);
