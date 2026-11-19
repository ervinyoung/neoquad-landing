# neoQuad landing

One site, two audiences. `/` speaks to students, `/schools` to administrators, and staff sign in from the nav.
`/privacy`, `/terms` and the not-found page share the same design.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/, deployed by Vercel
```

## The pieces

Each piece hides how it works behind a small interface. Start from the page and reach for these.

| Piece | Use | What it hides |
| --- | --- | --- |
| `Hero` | `<Hero scene="dusk" line={[…]}><Action to="app" /></Hero>`, plus an optional `slot="device"` and `device="phone" \| "window"` | The window, the coast, the word-by-word headline, when the action arrives, and the layouts: default (line bottom left, action bottom right), and the stage when a device is given (phones and tall windows: line on top, device rising behind one wide button; wide windows: line and action bottom left, device rising on the right; a window larger, running off the right edge) |
| `GlassPane` | inside a device shape, which sets `--pane-radius`, `--pane-frost`, `--pane-rim` | The hero glass both devices share: the frost, the light toward the top, the rim of light, the smoothed corner |
| `GlassPhone` | `<GlassPhone slot="device">…screen…</GlassPhone>` | A phone of the hero glass (`GlassPane`) with its Dynamic Island; scales to any width (sizes in `cqw`) |
| `GlassWindow` | `<GlassWindow slot="device">…screen…</GlassWindow>` with `<Hero device="window">` | A display-proportioned window of the same glass; sizes in `cqw` |
| `AppWireframe` | `<AppWireframe />` inside a `GlassPhone` | What stands on the phone, all from the iOS app: its icon and name, the SBCC campus outline (`src/data/campus-map.json`, from `python3 tools/campus-map.py`: the app's places plus the OpenStreetMap footprints they come from), and event pins drawn as `PinCore` draws them, on their real places, one live with its red pulse |
| `DashboardOutline` | `<DashboardOutline />` inside a `GlassWindow` | The staff dashboard's Insights view traced in hairlines (sidebar, header, four snapshot cards, the campus map tile, the comparison row, the chart's top), one figure from `dashboard/sample.ts`; fades up, cards settle in turn |
| `Symbol` | `<Symbol name="fork.knife" />` | The app's SF Symbols, sized by font size like SwiftUI; `swift tools/sf-symbols.swift > src/icons/symbols.ts` adds one (Apple's SF Symbols licence applies) |
| `Coast` | `<Coast scene="dusk" \| "blue-hour" />` | The photograph as a living place (WebGL, once the page is idle, paused off screen: a slow camera with parallax by depth, clouds on the wind, swell on the sea, from the map and plate made by `tools/coast-maps.py`), the soft first paint, the progressive blur (one table of stops, used by the still picture and the living one), preloading the other scene |
| `Action` | `<Action to="app" \| "booking" tone="clear" \| "accent" compact? />` | Links, labels, the iPhone / web swap, the Liquid Glass button |
| `Mark`, `Lockup` | `<Mark wave />`, `<Lockup />` | The seed artwork and its Wave |
| `HowItWorks` | `<HowItWorks />` | The three steps (post, live on the map, walk over) drawn in glass on one strip of the coast, which joins into one window on wide screens and plays once, left to right, as it comes into view |
| `Words` | `<Words parts={['Plain', { i: 'italic' }, 'br']} />` | Splitting a line into words that arrive in turn |
| `Dashboard` | `<Dashboard />` | The staff site's Insights, Events and New event screens rebuilt in HTML on its own 1862 × 1086 grid (every length `calc(var(--u) * px)`, so it scales sharp to any width), the shared sidebar, tabs and keyboard support. All figures, calendar events and the filled-in form come from `dashboard/sample.ts`, which derives every percentage and comparison so the screens agree; the map tile is `assets/dashboard/map.jpg` |
| `Nav` | (placed by `Base`) | Subtle Liquid Glass that reads what is under it and switches ink; the switch; the page's action, always there; staff sign-in beside it on wide screens |
| `Base` | `<Base audience="students" \| "schools" \| "none" …>` | Head tags, the persistent nav, footer, and the flags on `<html>` |
| `Legal` | `<Legal name="privacy" \| "terms" title={[…]} />` | Layout, contents list and text from `src/content/legal/` |

## Where to change things

| To change | Edit |
| --- | --- |
| Any outbound link (App Store, web app, staff, booking form, email) | `src/config.ts` |
| Colors, type, spacing, motion curves, the glass button, page transitions | `src/styles/global.css` |
| Student page / Schools page | `src/pages/index.astro` / `src/pages/schools.astro` |
| Privacy and Terms text | `src/content/legal/*.html` (and `*.json` for the contents list and date) |
| App screens in the iPhone frame, at 9:41 | `python3 tools/frame-screens.py` writes `src/assets/app/` |
| The seed logo | `src/data/seed.json`, `src/data/lockup.json` (from the Logo Pack) |

## Rules of the house

- Copy follows the Words slide of the guidelines: no "platform", "operating system", "engagement", "telemetry" or "users".
- One accent, neoQuad Blue (`--accent`, `#1477E7`). It marks the action and appears only below the first screen: the nav's action takes it once the hero has scrolled away, and the closing button has it. Everything else is black, white and the photographs.
- Buttons are Liquid Glass: clear on the first screen, tinted with the accent after it.
- A sharp photograph when the picture leads, a blurred one when words lead.
- Corners: an inner corner is the outer radius minus the space between them, and rounded rectangles are smoothed (Figma's 60%) with `--corner` and `--corner-reach`. The recipe is at the top of `src/styles/global.css`. Capsules and circles stay round.
- Motion is calm and has a job. On arrival the seed plays the Wave once and the headline settles in word by word. The sea keeps moving. Switching between Students and Schools pulls focus on the coast while the words change places. Controls respond to press. Hover styles are gated to real pointers, and everything respects Reduce Motion.

`legacy/` holds the previous single-file site for reference. It is not built or deployed.

`qa/` holds the last test pass: before and after screenshots for each fix, and the reports.
