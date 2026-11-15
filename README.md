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
| `Hero` | `<Hero scene="dusk" line={[…]}><Action to="app" /></Hero>` | The window, the coast, the word-by-word headline and when the action arrives |
| `Coast` | `<Coast scene="dusk" \| "blue-hour" />` | The moving sea (WebGL), the bottom-up blur, the drifting blur, preloading the other scene |
| `Action` | `<Action to="app" \| "booking" tone="clear" \| "accent" compact? />` | Links, labels, the iPhone / web swap, the Liquid Glass button |
| `Mark`, `Lockup` | `<Mark wave />`, `<Lockup />` | The seed artwork and its Wave |
| `Words` | `<Words parts={['Plain', { i: 'italic' }, 'br']} />` | Splitting a line into words that arrive in turn |
| `Dashboard` | `<Dashboard />` | The staff screenshots, tabs and keyboard support |
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
- One accent, neoQuad Blue (`--accent`, `#1477E7`). It marks the action and appears only below the first screen: in the nav once the hero has scrolled away, and on the closing button. Everything else is black, white and the photographs.
- Buttons are Liquid Glass: clear on the first screen, tinted with the accent after it.
- A sharp photograph when the picture leads, a blurred one when words lead.
- Motion is calm and has a job. On arrival the seed plays the Wave once and the headline settles in word by word. The sea keeps moving. Switching between Students and Schools pulls focus on the coast while the words change places. Controls respond to press. Hover styles are gated to real pointers, and everything respects Reduce Motion.

`legacy/` holds the previous single-file site for reference. It is not built or deployed.
