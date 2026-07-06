# Yoru — 夜 · a wind-down for the night

**[coneofcold.vercel.app/yoru-react.html](https://coneofcold.vercel.app/yoru-react.html)**

Yoru (夜, "night") is a single-purpose bedtime app: open it in bed and let one
screen carry you down to sleep — an optional slowing breath, a synthesised
nature soundscape that ebbs to silence, and a place to set down whatever you're
carrying into tomorrow. It does **one thing at one time of day**, and its whole
look, sound, and language commit to that.

Source: [`src/yoru/`](src/yoru/). Entry shell: `yoru-react.html`. Built on
`src/ds/` like any new app — see the [design-system rule](CLAUDE.md). Plain JSX
(not typechecked), same as Tempo and Law of the Day.

## One fixed look: Tokyo Night, frameless, always dark

Yoru has **no light mode and no free theme toggle** — a dim, dark, frameless
night. It imports the DS *components* but overrides the DS colour tokens in
[`src/yoru/yoru.css`](src/yoru/yoru.css) to the Tokyo Night "Storm" palette, so
every component adopts the night without special-casing Yoru. One warmer
variant, **Moonlight** (lilac/periwinkle), is offered in Settings and applied
app-wide via `<html data-yoru-palette="moonlight">` (set from `App`).

Frameless means edge-to-edge with no cards or borders at rest — the body itself
is the darkest surface, so the app never reads as "UI on a page".

## The home, and Settings behind the glyph

The home is as bare as it gets: the pulsing glyph **夜**, a line, and **Begin**.
The glyph is the title *and* the way into everything — **tap 夜 to open
Settings** ([`components/Settings.jsx`](src/yoru/components/Settings.jsx)), a
dark full-screen sheet (not a card) holding every choice, so nothing else
clutters the screen at bedtime. The hero pulses at the chosen breath's cadence
and its colour drifts slowly through the palette.

Settings: **name** (optional, used at the close), **length** (`15' 30' 45' 60'
90'`), **sound** scene, **volume**, **screen**, **colour** (Night / Moonlight),
and last, **breathwork** on/off with its **pattern**. Sound + volume **preview
live** while the sheet is open, so you can choose the scene by ear before a
session ever starts.

## The descent

- **Breathwork (optional)** ([`lib/breath.js`](src/yoru/lib/breath.js)) — a
  breathing orb, two patterns, both for falling asleep not alertness:
  - `exhale` (default): a **lengthening exhale, no hold** (~4s in / 6s→11s out
    across the session). A long, unforced exhale is the parasympathetic lever.
  - `478`: Dr. Weil's fixed 4·7·8.
  Turn breathwork **off** for a sound-only night; the centre then shows a still,
  softly pulsing 夜 instead of the orb.
- **Soundscape** ([`lib/soundscape.js`](src/yoru/lib/soundscape.js)) — see below.
- **The note** ([`components/Note.jsx`](src/yoru/components/Note.jsx)) — see below.
- **Tap the orb (or the ambient 夜) to end the night** — the whole centre is the
  stop control.
- Everything **dims toward black over the final stretch**, in step with the
  sound's ebb; the finish never arrives with a jolt.
- **Screen** — *Stay lit* (gentle dim) or *Go dark* (see the night sky below).
  The device is kept **awake during** the session in both modes on purpose: the
  soundscape is synthesised live, so if the display actually powered off the
  browser would suspend it and the sound would stop. When the session **ends**,
  the wake lock is released and the screen is free to **power off** to save
  battery. (A true screen-off, audio-all-night mode like Calm would need a
  media-element audio path — a deliberate future addition, not shipped.)

One rAF loop ([`lib/useDescent.js`](src/yoru/lib/useDescent.js)) drives the
countdown and the orb together; the screen is kept awake via
[`lib/useWakeLock.js`](src/yoru/lib/useWakeLock.js) (copied from Tempo — a new
app doesn't import from a legacy one).

## The soundscape (the load-bearing part)

Fully synthesised (no audio files), like Touch Grass. **Nature only — never
animals, never traffic or city.** Tuned for sleep. A warm brown-noise bed (that
breathes with you when breathwork is on) and a soft low pad anchor every scene;
on top:

- **Rain** — a soft high wash + sparse, quiet droplets + low wind.
- **Waves** — slow ocean surf that swells and recedes, each wave a slightly
  different length and height so it never becomes a metronome (built for people
  who already fall asleep to waves).
- **Wind** — air moving through the dark, gusting slowly.
- **Forest** — a hush of wind through leaves with occasional soft rustles; no
  birds, no insects.

**Intensity** (Faint · Gentle · Steady · Lively, default Gentle) sets the
*character* of a scene independently of volume: it thins the rain and spaces the
droplets, lengthens and softens the waves, eases the wind and rustles — from
faint and serene up to lively (the baseline). The warm bed and low pad are never
scaled, so there's always a steady floor; only the scene's own layers thin out.

The **master ebb** holds while you settle, then eases to **true silence** by the
session's end. Volume is user-controlled — **Off / Soft / Medium / Full** — with
the three audible steps spaced widely (loudness is perceived logarithmically) so
each is clearly distinct: Soft a whisper, Full filling a dark room. `Off` builds
no audio graph at all.

## The night sky (Go dark)

"Go dark" blacks the running screen to a near-black
[`components/NightSky.jsx`](src/yoru/components/NightSky.jsx): a few slowly
drifting, faintly twinkling **generic stars** (deliberately no constellations or
zodiac, unlike Touch Grass), the **moon at tonight's true phase** and — with a
granted location — its true place in the sky, and the occasional drifting
**sakura petal**. Deliberately very dim. Lunar data comes from `suncalc` via
[`lib/sky.js`](src/yoru/lib/sky.js) (phase is global; position is location-based,
so geolocation is requested only in this mode, and it degrades gracefully to a
gentle default moon if declined). Tap to peek at the orb.

## The note — offloading, not record-keeping

The note exists so you can put a thought *down*, not to keep a log — so it must
not linger on screen. `prompt` → `writing` → **"set it down"** → `held` (gone
from view, one faint way to glance back). At the session's end it's **discarded
entirely**.

## Same-night resume, fresh each new night; greeting

A "night" rolls over at **4am** ([`lib/night.js`](src/yoru/lib/night.js)). An
in-progress session and its note resume within the same night; a **new night
starts fresh** (the stored session is wiped once its `nightKey` no longer
matches). Settings persist across nights;
[`lib/storage.js`](src/yoru/lib/storage.js) owns both. If you set a name, the
close greets you — *"goodnight, <name>"*.

## PWA

Standalone, offline-capable, installable — scoped service worker
[`public/yoru-sw.js`](public/yoru-sw.js) registered from
[`src/yoru/main.jsx`](src/yoru/main.jsx), manifest
[`public/yoru.webmanifest`](public/yoru.webmanifest). Icons are the **夜** glyph
on a dark tile, rasterized by `npm run gen:yoru-icons`
([`scripts/generate-yoru-icons.mjs`](scripts/generate-yoru-icons.mjs)) — this
relies on a Japanese-capable system font. `main.jsx` also calls
`watchInstalled('yoru-react.html')` so the Cabinet can detect the install.

## Deferred

No guide page and no Notion spec yet — to be written retroactively. When adding
the guide, register it as `guide:` on Yoru's entry in
[`src/apps-registry.js`](src/apps-registry.js).
