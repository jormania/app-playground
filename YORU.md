# Yoru — 夜 · a wind-down for the night

**[coneofcold.vercel.app/yoru-react.html](https://coneofcold.vercel.app/yoru-react.html)**

Yoru (夜, "night") is a single-purpose bedtime app: open it in bed and let one
screen carry you down to sleep — an optional slowing breath, a synthesised,
blendable nature soundscape that ebbs to silence, and a place to set down
whatever you're carrying into tomorrow. It does **one thing at one time of day**,
and its whole look, sound, and language commit to that.

Source: [`src/yoru/`](src/yoru/). Entry shell: `yoru-react.html`. Built on
`src/ds/` like any new app. Plain JSX (not typechecked), same as Tempo.

## Look: frameless, always dark, a Japanese hand, three moods

No light mode. The type is one Japanese superfamily — **Zen Old Mincho** for the
display face (the 夜 glyph and titles) and **Zen Kaku Gothic New** for UI text
(loaded in `main.jsx`, wired through the `--font-display` / `--font-sans` tokens
in [`yoru.css`](src/yoru/yoru.css)). Frameless: edge-to-edge, no cards.

Three **atmospheres** (the palette toggle), all dark, applied app-wide via
`<html data-yoru-palette>` from `App`: **Night** (Tokyo Night Storm, cool),
**Moonlight** (lilac), **Candlelight** (warm amber, a paper-lantern glow).

## Home + Settings behind the glyph

Home is bare: the pulsing 夜 (title *and* the way in — tap it), a line, and
Begin. Settings ([`components/Settings.jsx`](src/yoru/components/Settings.jsx))
is a dark full-screen sheet: **your name**, **session length** (`15'–90'`),
**soundscape** (a quick-pick preset), the **audio tuner** (→ the Mixer),
**display mode**, **atmosphere**, and — only when the screen stays lit —
**breathwork** + **pattern**. Settings owns the single live sound preview
(debounced), so every change is auditioned by ear before a session.

## The audio: a layer-blend mixer

Fully synthesised (no files), following the ambient-mixer references that work
(A Soft Murmur / Noisli / myNoise): a **blend of independent layers**, not one
exclusive scene. Engine: [`lib/soundscape.js`](src/yoru/lib/soundscape.js);
UI: [`components/Mixer.jsx`](src/yoru/components/Mixer.jsx) — ten 0–10 sliders,
each with a discrete one-line hint, plus Reset, opened from Settings and
portalled to `<body>`. **Nature only — no animals, no city.**

- **Layers** (blend freely, 0 = off): **Rain** (wash + stereo droplets),
  **Waves** (slow surf), **Wind** (drifting, gusting), **Leaves** (wind through
  foliage + rustles), **Warmth** (a *pink*-noise floor — warmer and less boomy
  than brown), **Drone** (a soft low fifth).
- **Shapers**: **Volume** (master), **Brightness** (one global low-pass, dark→
  airy), **Motion** (how *much* it swells/gusts), **Pace** (how *fast* it drifts).
- The `soundscape` quick-pick in Settings stamps a starting blend (`SCENE_PRESETS`
  in [`lib/storage.js`](src/yoru/lib/storage.js)); the mixer refines it.
- **It always flows and ebbs.** A soft fade-in, a master ebb to true silence by
  the session's end, and a gentle release on stop — the sound never cuts,
  whatever the mixer is set to. There is no on/off: sound is the point; the
  Volume dial takes it as low as you like.
- The warm bed **breathes with you** when breathwork is on.

## Breathwork (optional)

A breathing orb, two patterns ([`lib/breath.js`](src/yoru/lib/breath.js)): a
**lengthening exhale, no hold** (default, exhale grows across the session) or
fixed **4·7·8**. Turn it off for a sound-only night — the centre then shows a
still 夜. Breathwork is hidden and inactive when the screen is dark or off (you
can't see the orb). **Tap the orb (or the ambient 夜) to end the night.** A very
discrete mm:ss countdown sits in the bottom-right.

## Display mode: lit · dark · off

- **Stay lit** — the orb, dimming toward the end.
- **Go dark** — blacks out to a live night sky (below), staying **awake** so the
  synthesised audio keeps playing. Tap to peek.
- **Turn off** — releases the wake lock so the device screen truly **sleeps to
  save power**, and flips back to *lit* the moment you re-engage.

Settings picks the *starting* mode; from then on it's **switchable mid-session**
via a quiet `lit · dark · off` control in the top bar — shown always in lit, and
during a peek in the covered modes (tap the sky / black to peek, the control
appears, pick a mode). Every transition is reachable and none disturb the running
session: the sound, the clock and the breath all keep going, only the screen's
behaviour changes. Lives in [`components/Session.jsx`](src/yoru/components/Session.jsx)
(`switchMode`) — a covered mode draws its overlay at once, *lit* clears it.

The screen is kept awake during lit/dark; when the session ends the lock is
released so the display can power down.

## The night sky (Go dark)

[`components/NightSky.jsx`](src/yoru/components/NightSky.jsx) +
[`lib/sky.js`](src/yoru/lib/sky.js), all on one dim canvas:

- **Generic drifting stars** (no constellations/zodiac, unlike Touch Grass),
  fading into the horizon as real ones do (atmospheric extinction) over a sky
  that is faintly darkest at the zenith.
- **The real moon** at tonight's true phase, placed by the device location where
  granted (via `suncalc`; geolocation requested only in this mode, degrades to a
  gentle default). Rendered as a body, not a plate — the **real near-side maria**
  (the man in the moon), **Tycho**'s ray splash fading in only near full, limb
  darkening, a photometric lit face, a soft terminator, a barely-visible
  earthshine dark side. It **leans** the way it really does: the bright limb
  points at the sun, tilting through the night (`moonBrightLimb` — needs a
  location, so without one the moon stays upright). Low down it **reddens** and
  its glow spreads, as anything seen through a long slant of air does.
- **Mount Fuji** — a static, dim silhouette rising from the lower centre:
  concave slopes, a flat summit with a crater notch, a snow cap with soft
  tongues, radial ridges, a veil of haze pooled at its foot, and a faint scatter
  of light around its rim. Unchanged across seasons. The **Hōei crater** swells
  one flank — Fuji's one famous asymmetry, and the thing that stops a cone
  reading as a pictogram (it sits higher up the slope than it really does,
  because the cone is wider than the frame and its true height is cropped off).
  **Shaded for real, by the moon itself**: direction from where the moon sits
  across the frame, elevation from its true altitude, strength from its
  illuminated fraction × presence. One light source, and the mountain obeys it
  exactly as the moon's own face does — the moon-facing flank takes the light,
  the far one falls away, and the terminator between them moves as the moon
  crosses the sky. A moon on the horizon rakes across and models it hard; one at
  mid-arc has culminated in the south, *behind* Fuji, and rims it; a new moon
  leaves it a shape in the dark. It is never brighter overall than the flat fill
  it replaced — the point is form, not glare.
- **Meteors** — rare, quiet sporadics as always, but on the **real shower
  nights** (`meteorShower`: Perseids, Geminids, Quadrantids, …) they come several
  times more often and stream away from the shower's true **radiant**, which
  rises and sets like anything else (`starPosition`) — so a shower whose radiant
  is still down stays quiet. Same honesty as the twilight wash: on an ordinary
  night none of this applies. Each meteor flares as it breaks up, and the
  brightest leave a train hanging for a second.
- **Season-aware drift** (astronomical, N. hemisphere): **sakura** (spring),
  **fireflies** (summer), **momiji** (autumn), **snow** (winter).

**The sky answers to touch**, on one rule — *it opens toward you* — with nothing
on screen to advertise it and no way to get stuck:

- **Hold and stir.** Rest a finger on the sky and the field swells and turns
  under your hand like still water round a spoon, rings pushing out from it. Lift
  and it settles back. The displacement is render-time only, so it always returns
  exactly where it started.
- **Pinch to lean in** toward the moon, which glides to the centre as its maria
  come up. Let go and it drifts home. One uniform transform over the whole scene,
  so nothing can fall out of register; stars keep their size, being point sources.
- A plain **tap still just peeks** — only a hold (>350ms), a drag or a pinch
  swallows the tap.

## The note — offloading, not record-keeping

The note exists so you can put a thought *down*, not to keep a log — so it must
not linger on screen. The prompt says why it helps (write it down, your mind can
stop holding it). `prompt` → `writing` → **"set it down"** → `held` (gone from
view, one faint way to glance back). At the session's end it's **discarded**.

## Same-night resume; PWA

A night rolls over at 4am ([`lib/night.js`](src/yoru/lib/night.js)); a session
and its note resume within the same night, fresh on a new one. Settings persist.
Standalone, offline, installable — scoped SW [`public/yoru-sw.js`](public/yoru-sw.js),
manifest [`public/yoru.webmanifest`](public/yoru.webmanifest), 夜 icons via
`npm run gen:yoru-icons` (needs a Japanese-capable system font). `main.jsx` calls
`watchInstalled('yoru-react.html')` for the Cabinet.

## Guide

[`public/yoru-guide.html`](public/yoru-guide.html) — a standalone, always-dark
page in Yoru's own Zen Old Mincho / Zen Kaku Gothic New hand and Tokyo Night
Storm palette, walking through Settings, the mixer, breathwork, the three
display modes, the night sky, and the note. Registered as `guide:` on Yoru's
[`src/apps-registry.js`](src/apps-registry.js) entry, so it's linked from
`index.html`'s card — **deliberately not linked from inside the app itself**,
to keep Yoru down to one screen and one way in (the glyph). Notion spec: **Yoru
— App Spec** under Dev / App Specs, also listed on **Apps at a glance**.
