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
UI: [`components/Mixer.jsx`](src/yoru/components/Mixer.jsx) — twelve 0–10 sliders,
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

### Playing on: headphones or a speaker

`VOICINGS` in [`soundscape.js`](src/yoru/lib/soundscape.js), picked by
**Settings → playing on**. `headphones` is the reference tuning and changes
nothing. `speaker` differs by **one number**: a 55 Hz high-pass on the master,
placed before the limiter.

That is deliberately slight, and the story of how it got that way is the point.
The first cut assumed a small sealed portable, high-passed at 120 Hz and shifted
the swell, the drone and thunder up whole octaves. The actual speaker is an
**IKEA ENEBY 20** — 1× 3.2″ woofer plus 1× 1″ soft dome tweeter, rear reflex
port, 15 W + 5 W, and IKEA's manual claims 48 Hz–20 kHz. On a box like that the
aggressive profile is destructive: it throws away real, audible bass, which is
exactly the swell depth the layers are tuned to deliver. **Guessing at a
speaker's response and voicing around the guess is worse than leaving it alone.**

What a ported box genuinely wants is a *subsonic* filter. Below the port's
tuning the woofer unloads — excursion climbs steeply, acoustic output doesn't —
and the result is distortion and port noise rather than bass. Thunder starts at
28 Hz, so trimming under 55 Hz costs nothing audible and buys clean headroom for
everything above it. Asserted: the filter sits **below** every layer that
carries the scene's body (waves, warmth, drone) so it can't take any of that
away, and **above** thunder's own corner, since thunder is the one layer that
reaches under the port.

#### Loudness — the low end at low volume

At bedtime volume the ear's own low-frequency sensitivity falls away. Between a
normal listening level and a quiet one, the bottom two octaves lose roughly
10–15 dB *relative to* the midrange — equal-loudness (the Fletcher–Munson
effect), a property of hearing rather than of the speaker or the mix. It is the
better explanation for "too much foam, not enough swell": the foam sits at
600–1900 Hz, near the ear's most sensitive region, while the swell it competes
with is weighted low and fading fastest as you turn down. **No voicing, and no
amount of Volume, addresses this** — turning up scales both equally.

**Settings → loudness** does: a low shelf at 250 Hz whose gain rises as Volume
falls, the way a hi-fi loudness button works (`loudnessLiftDb`).

| Volume | shelf |
|---|---|
| 10 | +2.0 dB |
| 8 | +3.2 dB |
| 5 | +5.0 dB |
| 2 | +6.8 dB |

Note where the reference sits: Yoru's own ceiling is 0.24, about −12 dBFS, so
even **Volume 10 is not a loud listening level** — which is why the curve still
lifts a little at the top of the range rather than reaching zero there.

It is taken from the Volume *setting*, not from `master.gain`, which is being
automated through the fade-in and the ebb to silence all night. In the chain it
sits `master → shelf → voicing high-pass → limiter`: the shelf lifts *before*
the high-pass, so the high-pass still strips the subsonic content it just
boosted, and both sit before the limiter so a lifted low end is caught rather
than clipped. Off by default — a night you already have sounds exactly as it did
until you ask for this.

**On a mono speaker** — and the ENEBY 20 is mono, one channel through a two-way
driver pair; two-way is not two-channel — also turn *stereo* off. The
decorrelated L/R pair buys nothing once summed to one driver, and off halves the
noise sources, which is real battery over a 90-minute session.

### The eleven curated blends

Eleven hand-tuned mixes in [`lib/storage.js`](src/yoru/lib/storage.js)
(`CURATED_MIXES`), shown as chips in Settings' **your mixes** row ahead of your
own saved ones. They ship in **code, not seeded into `customMixes`** — those
four slots are yours (`MAX_CUSTOM_MIXES`), and a seeded copy would either come
back after you deleted it or never get the benefit of a later retune.

**They deliberately do not set `volume`.** Applying one merges over the current
mix, so your own loudness survives. A preset carrying its own volume could jump
the level the instant you tapped it, which is the one thing a sleep app must
never do. Each also gets a unique `scene` id (`curated:<id>`) so the Settings
preview *crossfades* between two of them — the switch logic keys off `scene`
changing, and a shared `'custom'` would drop it onto the hard 0.15s release path.

| | leads with | why it's here |
|---|---|---|
| first rain | Rain | the archetype, and the clearest listen for the droplets |
| eaves rain | Rain, sparse | drops about one a second — you hear each one land |
| cedar rain | Rain + Leaves | the shared weather drift, audible: one gust moves all three |
| far storm | Rain, dark | Brightness 3 puts the whole storm behind glass |
| long swell | Waves | the deepest swell the layer will give you |
| low tide | Waves | the same sea drawn right down |
| night sea | Waves + Drone | Brightness 2 takes the foam out, leaving swell and hum |
| mountain brook | Stream | close and bright; the resonant bubbles carry it |
| stone hollow | Stream, dark | the same water from further off, the room doing more of the work |
| river rain | Stream + Rain | Stream is outside the weather, so it holds while the rain ebbs |
| night garden | Leaves + Chime | the only blend with a furin, at 2 |

**Wind never leads.** It thickens and animates a scene — it carries the shared
weather drift, which is what makes one gust read across Rain and Leaves too —
but nothing here is a wind blend, and that is asserted rather than left to
taste: `wind` must be strictly below the loudest other layer in every mix.

The sleep guardrails are **asserted, not trusted**: Chime never above 2 and in
only one blend; Motion ≤ 6, Pace ≤ 4; and any blend with Rain ≥ 6 must have
Brightness ≤ 4 — Rain's level *is* Thunder's, and dark is what makes a roll read
as far away rather than overhead. Every blend also has to keep a floor under it
(some Warmth or Drone) and every one is built through the engine in a test.
Steady-state levels sit within a 4.8 dB spread, so moving between them in the
preview doesn't lurch.

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

The two noise beds are generated **once per sample rate and shared across
contexts** (`sharedNoise`). Settings rebuilds the entire soundscape on every
debounced mixer change, and generating 30s of white plus 26s of pink is ~2.7M
random draws and ~11MB — paying that every 140ms while you drag a slider is
pure waste. An `AudioBuffer` isn't bound to the context that made it, and the
cache is keyed by rate, so switching output (phone speaker to Bluetooth, which
changes the rate) just makes a second entry.

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
| surf hiss too strong / harsh | wave foam `fv = (0.016 + …)` and its band (600–1900) |
| swell not deep enough | body `peak = (0.62 + …)`, its trough, and the bed — the swell is the RATIO of these |
| rustles too soft / too loud | leaves `v = (0.12 + …)` — remember the ×4.76 duty-cycle factor |
| stream too tonal | the `Math.random() < 0.2` share of resonant bubbles, and `cv` |
| thunder too heavy | the first crest's weight (0.9) and `crests` |
| chime too metallic / too dull | `CHIME_DAMPING` (0.7) — higher darkens it faster |
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

It is now four parts:

- **Body** — 70 Hz up to a sweep that tops out around 1000–1380 Hz, on one shared
  envelope, rising slowly and then steepening into the crest. Swells are one
  continuous motion of water; they genuinely don't stack, so one envelope is
  right for this part. More of what reads as a wave *arriving* is that sweep than
  is the gain.
- **Break** — short, wide (500–3000 Hz), loud: about 1.2–1.7 s from hit to gone.
  **This is what "force" is.**
- **Drain** — long, narrow (600–1900 Hz), quiet: water retreating over sand for
  seconds afterwards. Both of these get **their own gain node per wave**, which is
  why the per-wave node has to exist: one shared param is one timeline and can't
  overlap itself. They share one panner — a break and its own retreat happen in
  the same place along the shore.
- **Distant surf** — a quiet steady bed (130–900 Hz) so the troughs are a
  shoreline rather than a gap. It lifts the between-waves floor ~9 dB, which is
  what stops the pumping.

#### Break and drain are not the same thing, and conflating them cost three rounds

They live in overlapping bands, so it is tempting to treat them as one "foam"
chain — which is what this was, and it was wrong. **A break is short and
broadband; grit is sustained and narrow.** With one envelope doing both, every
instruction to take the pebbles down took the break down with it. Three cuts in a
row (−18.4 dB → −22.4 → −28.5 under the crest) ended with **0.10 % of the layer's
energy above 1 kHz** — no break at all, and so a swell with no force behind it,
which is exactly how it was reported.

Split, the break peaks at roughly the same level as the version that got called
"pebbles out of a sack" — but for ~1.4 s instead of ~6, and topping at 3000 Hz
instead of 4200, so about a quarter of the energy per wave. Energy above 1 kHz at
the crest is now ~18 %. **If that still reads as grit, the level is wrong and
`kv` comes down; if it reads as impact, the duration was the whole story.**

Note what the *global* Brightness does to this: at Brightness 2 the low-pass sits
at 903 Hz and removes the break before you hear it. `night sea` is deliberately
that dark. For force, Brightness 5 or above — which is where `long swell` sits.

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

### The per-layer pass

Four shape changes, each done with one rule: **measure RMS before and after —
the change is to character, not loudness.** Every one of them alters a sound's
level as a side effect of altering its shape, and every one is silent when you
get it wrong: the diff looks like a character change and the mix quietly moves.

- **Leaves — granular.** A rustle is many individual leaf contacts, not one
  soft whoosh. This is the layer's real problem: rustles share a band with the
  hush they sit on, so a smooth burst can never separate from it at *any* level,
  while a cluster of very short ticks separates at almost none. One noise source
  with the ticks scheduled on a single gain, **not** one source per tick — that
  would be ~8 new nodes a second on top of the convolver, and this costs exactly
  what the blob it replaces cost.

  The first granular cut sounded like **chittering**, which is a precise
  complaint: it means the ticks read as an *animal*, and this app's rule is
  nature only. Three causes, all shape:

  1. **One bandpass per rustle, not per tick.** The filter was built once per
     burst at Q 1.0, so all its ticks shared a centre frequency and therefore a
     *pitch*. A train of same-pitched chirps is the definition of chittering.
     Leaf contact has no pitch — a plain high-pass/low-pass pair leaves the ticks
     broadband and dry, and each then differs on its own because each gates a
     different slice of the noise running underneath.
  2. **1600–3200 Hz** is where insect stridulation and small-bird calls live.
     Now roughly 500–6400 Hz, varied per rustle.
  3. **~27 Hz tick rate** — the flutter/buzz region: too sparse to fuse into
     texture, too fast to read as separate events, and exactly where stridulation
     sits. Now ~85 Hz, where the pulses fuse and you hear the material rather
     than the rhythm.

  Two statistical fixes went with it: amplitudes follow a power law (`rand^2.2`)
  rather than a uniform spread, because a rustle is many small contacts of which
  most are faint; and the gaps cluster (`rand^1.6`) rather than spacing evenly,
  because leaves are struck in bursts as air moves through them. Even spacing and
  even amplitudes are the other half of what reads as an animal.

  The trap, both times: ticks occupy a fraction of the span where a blob occupied
  all of it, so **RMS parity has to be measured, not assumed**. The first cut
  needed ×4.76 and I wrote ×2.6, which would have made the rustles ~5 dB quieter
  while looking in the diff like a pure character change. The chittering fix
  needed +2.4 dB for the same reason, and landed at +0.25 dB measured.

- **Stream — one bubble in five is resonant.** A bubble in water is a damped
  oscillator whose pitch *rises* as it shrinks and ascends (Minnaert: f ≈ 3.26/r,
  so 1–5 mm gives ~650–3300 Hz). That upward chirp is the most recognisable thing
  about running water and no filtered noise has it. Only one in five: a brook is
  mostly broadband splash, and a stream of pure tones would be both wrong and —
  the part that matters here — attention-grabbing. The trap: a sine keeps 0.707
  of its gain as RMS where the bandpassed burst keeps 0.121, so reusing the
  bubble's own constant would put the brook's events **+15 dB** in one commit.
- **Thunder — it rolls.** A lightning channel is kilometres long, so its sound
  arrives as a train from successively further parts of it, re-scattered by
  terrain: several irregular crests over 6–12 s. The trap: five crests at the old
  per-burst level is **+7 dB**, each feeding the deepest send in the file. They
  sum into one gain and one send, the nearest crest peaks at 0.9× the old single
  peak and the rest fall away — instantaneous loudness slightly *down*, duration
  up. Rides the `shower` drift, so a squall and its thunder are one weather
  system rather than two clocks. The per-event filter wobble is gone: the crests
  are the irregularity it was standing in for.
- **Chime — per-partial decay.** Struck metal darkens as it rings, because its
  partials decay at different rates. One shared envelope can never do that, which
  is why it read as a synth tone with a bell-ish ratio in it. Each partial decays
  at `ring / ratio^0.7`, plus a brief noise strike and a detuned second voice on
  the fundamental for the warble. Near level-neutral by construction: the
  partials are normalised so the sum's RMS at the strike matches the old pair's.

Two of these are asserted rather than trusted — `CHIME_PARTIALS` ordering, and
that a rustle schedules dozens of ramps rather than one. Both are invariants a
later edit could undo while looking like it changed nothing.

### Brightness as distance

Brightness on its own models exactly one distance cue — high-frequency air
absorption — and models it as a cliff. The ear doesn't read a cliff as distance;
it reads it as the same source with something over it. Four of the eleven blends
already use a dark Brightness to *mean* "further away" (`far storm` at 3 puts a
wall at 1189 Hz, `night sea` at 2 at 903 Hz), and the control was working against
them: the comment on `far storm` said "behind glass", which is muffled, not far.

The cue that actually carries distance is the **direct-to-reverberant ratio** —
further away, proportionally more room and less source. So a dark setting now
also opens the sends (`distanceSend`):

| Brightness | send |
|---|---|
| 10 | ×1.00 |
| 8 | ×1.19 |
| 5 | ×1.57 |
| 2 | ×1.99 |

Only the **wet** side moves. Pulling the dry down to complete the picture would
make exactly the blends that want to sound far also sound quiet, and they are
already the quiet ones. It composes correctly with the existing wet low-pass
(`toneHz × 0.6`): a darker setting gets more reverb *and* a darker reverb, which
is what distance actually does. Capped at ×2.2, so "distant" never becomes
"underwater".

**The low-pass is untouched, deliberately.** The fuller version replaces it with
a tilt, which would change what an already-saved Brightness value sounds like —
a `MIX_VERSION` bump, which wipes saved custom mixes. The send coupling carries
most of the value and needs no migration: dark still means dark, it just also
means further. The tilt stays on the shelf.

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
