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

- **Layers** (blend freely, 0 = off): **Rain** (wash + stereo droplets, and a
  rare distant **thunder** roll that rides Rain's own level — no separate
  slider), **Waves** (slow surf), **Stream** (a steady brook, softly babbling),
  **Wind** (drifting, gusting), **Leaves** (wind through foliage + rustles),
  **Chime** (a sparse furin — an *accent*, meant to sit over another layer, so
  it has no quick-pick preset of its own), **Warmth** (a *pink*-noise floor —
  warmer and less boomy than brown), **Drone** (a soft low fifth).
- **Shapers**: **Volume** (master), **Brightness** (one global low-pass, dark→
  airy), **Motion** (how *much* it swells/gusts), **Pace** (how *fast* it drifts).
- The `soundscape` quick-pick in Settings stamps a starting blend (`SCENE_PRESETS`
  in [`lib/storage.js`](src/yoru/lib/storage.js)); the mixer refines it.
- **It always flows and ebbs.** A soft fade-in, a master ebb to true silence by
  the session's end, and a gentle release on stop — the sound never cuts,
  whatever the mixer is set to. There is no on/off: sound is the point; the
  Volume dial takes it as low as you like.
- The warm bed **breathes with you** when breathwork is on.

### The four rules that keep it from sounding synthetic

Filters and levels decide what a layer *is*; these decide whether the ear files
it under "outside" or under "a machine". They are stated at the top of
[`soundscape.js`](src/yoru/lib/soundscape.js) and apply to every layer —
**keep them when adding or reworking one.**

1. **Nothing shares a waveform.** Every noise source reads the one shared buffer
   from its own random offset — one-shots included. Before this, every droplet,
   bubble and rustle started at sample 0 of the same buffer, so all of them were
   literally the same few milliseconds of noise wearing a different filter; and
   layers that share samples fuse into a single source however differently
   they're filtered. Stereo width comes from two far-apart offsets, not from the
   ±1.5 % playback-rate detune it used to use — two copies of one buffer at
   different rates start aligned and slide apart, which means they also slide
   back together, collapsing the image to near-mono and re-widening on an
   ~11-minute cycle.
2. **Nothing repeats.** Every "organic drift" is an aperiodic mean-reverting
   random walk (`driftStep`), not an LFO. A 0.05 Hz sine repeats 180 times an
   hour and the brain will find it. The walk's target is shaped rather than
   uniform, which is what gives it weather's actual character: calm most of the
   time, a real gust now and then.
3. **Everything transient has a room.** A dark synthetic reverb
   (`reverbImpulse` — decaying noise, one-pole low-passed, per-channel unit
   energy) on a send bus. Dry point sources sit inside your skull. Continuous
   washes stay **dry** — running steady noise through a reverb only adds level
   and mud. Thunder gets the deepest send: distant thunder *is* its
   reverberation. The wet path is deliberately quiet — a room you notice is a
   room set too wet, and an unexpectedly loud tail at 2am is the worst failure
   this file can have.
4. **One breeze moves the whole scene.** Wind, Leaves and Rain share a single
   `weather` drift, so a gust brightens the air, stirs the trees and pushes the
   rain in the same instant — wind's gain and its filter used to run off two
   unrelated LFOs, so it got louder and brighter out of phase, which is a very
   strong tell that nothing is actually moving. Each layer keeps an independent
   drift of its own too, so the mix breathes as a *place* rather than as one
   tremolo. **Stream is deliberately left out** — a brook is the steadiest thing
   in a landscape, and coupling it is what would tip the whole mix into
   breathing as a single organism.

Missing browser support for `ConstantSourceNode` or `ConvolverNode` costs the
drift or the room, never the night's sound — both degrade, neither throws.

### Tuning by ear — the wash/event ratio, and where the knobs are

The pass above was calm but flat, and the fix turned out to be one ratio rather
than a general "turn it down". **Every event layer was being masked by its own
continuous wash**: rain's droplets sat **10.5 dB under** its wash, stream's
bubbles 9 dB under theirs. That reads as a downpour with no drops in it — the
events are present, they're just underneath. Lowering the wash and lifting the
events (rain now +0.9 dB, stream −3.1 dB) buys the individual droplets back
*without* making the layer quieter overall, which a Volume change could never do.

The same reasoning darkened everything: continuous broadband energy is what
reads as pressure rather than calm, and treble is what makes a wash fatiguing.
So washes came down in level and lost their top octave; the events kept theirs,
and got softer onsets (a 4 ms attack is a tick; 10 ms is a drop).

**Forest** was a special case of the same thing: `buildLeaves` builds an internal
wind chain, and it ran *louder and brighter* than the Wind layer itself, so a
forest blend carried two wind beds with the rustles buried under both.

If a layer needs nudging, these are the numbers — all in
[`soundscape.js`](src/yoru/lib/soundscape.js), all per-layer, none of them
touching the mixer's meaning (so **don't** bump `MIX_VERSION` for a retune —
that would wipe saved custom mixes):

| To change | Touch |
|---|---|
| how wet the room is | `wet.gain.value` in `buildRoomUnsafe` (0.75), then a layer's own `sendToRoom` amount |
| how big the room is | `reverbImpulse(..., 2.0)` — unit-energy, so length costs no loudness |
| rain: downpour vs. droplets | wash `base = 0.055 * level` against droplet `v = (0.045 + …)` |
| rain: harshness | the wash's low-pass (4500) |
| droplets more distinct | droplet `bp.Q` (1.4) and the `nextAt` interval |
| stream: hiss vs. babble | wash `g.gain` (0.036) and `bp.frequency` (1250) against bubble `v` |
| forest weight | `buildWind(white, level * 0.34, 940, …)` inside `buildLeaves` |
| wind pressure | `0.27 * p.wind` at the call site, and the gust depth `level * 0.36 * motion` |
| gusts too squally | the `gust` clamp in `buildLeaves` (`1 + 0.5 * w`, capped 1.55) |
| surf too big | wave `peak = (0.4 + …) * level * motion` |
| surf hiss too strong / harsh | wave foam `fv = (0.028 + …)` and its band (700–2500) |
| waves not individual enough | the distant bed `fag.gain` (`0.028 * level`) — it sets the floor the crest stands against |
| one wave's hiss runs into the next | the foam `drain` (≈0.3 of a period) |

### Waves: three events, not one envelope

A wave is not one sound. It is the swell approaching (low, broad, rising), the
break (a burst of bright splash), and then the retreat — a high hiss draining
back over sand for seconds after the water has gone, which is the part that
makes an ear say *beach*. The layer used to run all three through **one gain and
one filter sweep on one timeline**, so the highs peaked exactly when the loudness
peaked and died exactly when it died: a "woomp" with a tonal wobble, no break in
it and no hiss behind it. It also ran strictly one wave at a time
(`nextAt = end`), which no coast has ever done, and fell to −27 dB between waves,
which made the whole layer pump.

It is now three parts:

- **Body** — dark (90–500 Hz), on one shared envelope, rising slowly and then
  steepening into the crest. Swells are one continuous motion of water; they
  genuinely don't stack, so one envelope is right for this part.
- **Foam** — bright (850–4200 Hz), with **its own gain node per wave**, opening
  just *before* the body peaks and draining for about half a period afterwards.
  That's what makes the last wave still hiss while the next one rises, and it's
  why the per-wave node has to exist: one shared param is one timeline and can't
  overlap itself. Each is panned separately — waves break along a front, not at
  a point.
- **Distant surf** — a quiet steady bed (130–900 Hz) so the troughs are a
  shoreline rather than a gap. It lifts the between-waves floor ~9 dB, which is
  what stops the pumping.

**The floor is the swell.** The first cut of this set the distant bed at
`0.055 * level` and dropped the body's trough to fill the gaps — and it worked,
in that the pumping went away. It also lifted the between-waves floor 9 dB and
so took **10 dB out of the swell's dynamic range** (27 dB → 17 dB), which is the
whole reason waves read as individual events rather than as one continuous sea.
That was fixing a complaint nobody made at the cost of the thing that was
working. The bed is now `0.028 * level`, still ~4 dB above the old near-silence
so it doesn't pump to nothing, and the swell is back to 22 dB.

The foam's band matters as much as its level: 850–4200 Hz put flat noise straight
across 1.5–4 kHz, the presence/harshness region, and it read as **pebbles poured
out of a sack** rather than water draining over sand. 700–2500 Hz instead.

Balance at the default Motion, against the body's crest: foam −17 dB, distant
bed −22 dB, and the foam still sits 5 dB over the floor so the retreat is
audible. The drain is ~0.3 of a period, not half — long enough to reach the next
swell's rise, short enough that it doesn't run into the next break.

Sets are real too — swell arrives in groups — so one slow drift scales size and
period together, and period now grows slightly with Motion. Leaving Motion and
Pace fully orthogonal let you dial waves that were huge *and* fast, which is a
washing machine rather than a sea.

**The per-wave nodes must be swept.** They hang off a foam chain that never
stops, so they can never be collected on their own — ~1000 live nodes by the end
of a long night, all processing silence, with nothing in the app to show it.
`retire()` hands them to the tick, and note it disconnects the **incoming** edge
as well: `disconnect()` clears a node's outputs only, so the foam chain would
otherwise go on feeding every wave's gain until morning.

Still to do (the per-layer pass): Stream's bubbles want to be upward-chirped
damped sinusoids (Minnaert) rather than filtered noise clicks;
Leaves' rustles should be clusters of very short ticks rather than swelled noise
blobs — they share a band with the hush they sit on, so no amount of level will
separate them until their *shape* changes; Thunder should roll in several
sub-peaks; Chime needs per-partial decay. Brightness would read as *distance*
rather than a blanket if it were a tilt coupled to the reverb send.

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
appears, pick a mode).

**Keeping the soundscape alive with the screen off** — `Session` holds an
active [Media Session](src/shared/mediaSession.js) for the whole session
(`stop` mapped to ending the night; no `play`/`pause`, since Yoru only ever
ends, never pauses). This isn't for on-screen controls — it's what keeps
Android Chrome from throttling or suspending the synthesised audio once the
screen locks, which used to cut the soundscape off well before its own timed
ebb, especially in *Turn off* (which deliberately drops the wake lock so the
screen truly can lock). `soundscape.js` also self-heals: alongside the
existing `resume()` (fired on `visibilitychange`), a 3s watchdog polls for
and resumes a suspended `AudioContext` directly, since a stray suspension
doesn't always line up with a visibility event landing in time. Promoted from
Tempo, which used the same trick first for its own lock-screen transport
controls — `src/tempo/lib/mediaSession.js` is now a thin re-export.

Under that control sits **one quiet line about the moon**, led by tonight's moon
drawn at its real phase ([`MoonGlyph`](src/yoru/components/MoonGlyph.jsx), sized
in `em` so it tracks the text) and then said in words (`moonBrief` in
[`lib/sky.js`](src/yoru/lib/sky.js)) — *"◑ waxing gibbous · high in the south"*,
or when it's down, *"◑ last quarter · rises tonight around 00:30, in the east"*.
The glyph keeps its outline ring even at new moon, when there's no lit face at
all and it would otherwise be a blank gap where a moon should be.
Shown in **all three modes**: only *go dark* ever draws the sky, so lit and off
would otherwise give you no way of knowing there's a moon out at all. The time is
approximate on purpose (nearest half hour, "around"), and *tonight* / *tomorrow*
follow **Yoru's own 4am night**, not the calendar's midnight — at 11pm a moon
rising at 00:30 is still tonight. Because of this line, **geolocation is now
requested in every display mode**, not just *go dark* as it was: without
coordinates the line can only name the phase (which is the same the world over),
never where the moon is or when it's due. Declining just shortens the line. Every transition is reachable and none disturb the running
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
  granted (via `suncalc`; degrades to a gentle default). Rendered as a body, not
  a plate — the **real near-side maria**
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
  mid-arc has culminated in the south, *behind* Fuji, and rims it. Under it all
  sits a **starlight floor** that the moon doesn't scale — a real landscape is
  never black, and the sky dome is a dim source of its own favouring whatever
  faces up — so at a new moon, or with the moon down, Fuji keeps its **slopes**
  and not just a snow cap floating in the dark. At its brightest it is still no
  brighter than the flat fill it replaced: the point is form, not glare.
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
