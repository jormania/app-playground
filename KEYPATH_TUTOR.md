# KeyPath — tutor design (v0 “taster”)

The design of the learning app that follows the probe (`KEYPATH.md`), and
the record of what's been built (§9). The hardware questions are answered in
`KEYPATH.md` §1; this document is about **what Nora does with it**.

Decisions below were taken with Gabriel on 2026-09-24. Open questions are at
the end: some can only be answered by Nora.

---

## 1. Principles

1. **Confidence first, precision later.** Correcting is a setting, never a
   default punishment. KeyPath may *suggest* raising the bar; it never does so
   by itself.
2. **She chooses.** No single prescribed route. The taster offers every kind
   of learning from the start and lets her pick, every time.
3. **Measure, then deepen.** The taster exists to find out what Nora actually
   responds to. It records what she opens, finishes, abandons and returns to,
   so the next round of work follows evidence, not guesses.
4. **Private by default.** Progress stays on the phone it was made on; songs
   she or Gabriel add are never uploaded or committed (`KEYPATH.md` §7).

---

## 2. People and profiles

| Profile | Starting point | Device |
|---|---|---|
| **Nora** | Plays some tunes by ear, a little with both hands; has used Simply Piano and Flowkey; **doesn't read notation** | Poco F3 (compatibility check pending, `KEYPATH.md` §2) |
| **Gabriel** | **Total beginner**; also the first real test of the beginner path | Galaxy S24 |

Both start from the beginning (“a reset”); anyone can **test out** of early
steps (§4, Journey).

### Per-profile settings

| Setting | Options | Default |
|---|---|---|
| Language | English · Română | **English** |
| Note names | Follow language (C D E / Do Re Mi) · C D E · Do Re Mi · Both (“C / Do”) | Follow language |
| Names on the keys | On · Off (the falling notes keep their names either way) | On |
| Finger numbers on the notes | On · Off (only songs with written fingering have any: the starter pack and the Journey's tunes, not added songs) | On |
| On a wrong note | Easiest first: **Wait for it** (song pauses until the right note) · **Show it** (wrong key flashes, song continues) · **Keep going** (nothing live; report at the end) | **Wait for it** (changed after step 5; players created before keep what they had) |
| Timing | Relaxed (wide window; early/late never counts against) · Normal · Strict | Relaxed |
| End-of-piece report | Off · Short (stars + one “try this next”) · Detailed (which bars/notes, early/late) | Short |
| Wrong notes affect stars | Yes · No | No |
| Sound through the keyboard | 0–100 (the probe's control) | 0 |

Reports lead with **what went right** before any correction.

### The ramp

After a piece that went very well, the report suggests the next rung, one
setting at a time, and changes nothing unless she says yes
(`nextStep()` in `engine/settings.ts`):

| Rung | On a wrong note | Timing | What she's learning |
|---|---|---|---|
| 1 | Wait for it | (none: no clock) | the notes, with no time pressure |
| 2 | Show it | Relaxed | playing in time, mistakes shown gently |
| 3 | Show it | Normal | tighter timing |
| 4 | Keep going | Normal | playing it through, like a performance |
| 5 | Keep going | Strict | polish |

Two more axes are chosen per song, not suggested: **speed** (50 → 75 →
100%) and **hands** (right → left → both). **Names on the keys** has its own
moment: passing the Journey's reading check (step 6) offers to turn them
off, since she can then read a note and find its key without the label.

Until then, key names stay on in the reading check: its skill is staff →
name, and name → key was already tested in step 2.

Romanian needs ș ț ă â î: fonts must include the **latin-ext** subset (see the
font rules in `CLAUDE.md`; Loom's `fonts.css` is the worked example).

---

## 3. Home: four doors

A home screen with four equal doors. No gate between them, no required order.
The last one used is remembered, not forced.

| Door | Taster version (v0) | Borrowed from |
|---|---|---|
| **A. Songs** (the backbone) | 5–10 starter pieces + your own MIDI files. Learn right hand → left hand → both. Falling notes on a keyboard, with letter names. Then play it through | Flowkey, Simply Piano |
| **B. Journey** | A small map of ~6 steps: find middle C → C-D-E → a five-finger melody → first chord → first two-hand piece → first bar of real notation. Each step can be **tested out** in ~30 s: if you can already do it, it unlocks and you move on | Simply Piano |
| **C. Challenges** | Three games: **note race** (find the key shown, by name or on a staff, against the clock), **rhythm echo** (KeyPath plays a rhythm, you copy it) and **chord catch** (a chord is named, play it) | Rhythm/party games |
| **D. Studio** | Free play over a keyboard Style; record, play back, keep favourites. After a song in A: a **“make it yours”** moment: play its melody over a Style, or invent an ending | nothing mainstream |

A and D are linked on purpose: every learned song offers a creative follow-up.

---

## 4. The shared engine (where the real work is)

All four doors run on one engine, so each door is a thin layer.

```
MIDI layer (built, src/keypath/midi/)  →  Judge  →  Feedback policy  →  UI
                                            ↑
                                        Song model  ←  starter pack / MIDI import
```

- **Song model.** Notes with start, duration, hand, and optional bar lines;
  tempo and time signature. Built from the starter pack or an imported MIDI
  file.
- **Judge.** Compares what's played with what's expected, using every rule the
  probe established (`KEYPATH.md` §1):
  - listens to **channels 1–8 only**, never the accompaniment (9–16);
  - **timestamps**, not arrival time;
  - a **“together” window** for chords, starting at 60–80 ms and tuned on Nora;
  - a **minimum velocity** so a grazed key doesn't count;
  - an **octave check** at the start (“press middle C”), because Transpose and
    the voice Octave settings shift note numbers.
  The judge always scores the same way whatever the settings, so progress stays
  comparable.
- **Feedback policy.** Turns judge results into what she sees and hears,
  according to her settings (wait / show / keep going; report depth).
- **Clock.** Can follow the keyboard's own tempo (MIDI Clock) or run its own.
- **Rendering rule:** update the screen at most once per frame, never per MIDI
  message (measured in `KEYPATH.md` §1).
- **Dropped keyboard:** pause when the input disappears, resume when it's back.

---

## 5. Songs: where they come from

1. **Starter pack**, built into the app: 5–10 short **public-domain** melodies,
   arranged by us for beginners (candidates: *Ode to Joy*, *Twinkle Twinkle*,
   *Frère Jacques*, *Au clair de la lune*, *Melc, melc, codobelc*). The
   arrangements are ours; each gets a provenance note, as `KEYPATH.md` §7 and
   `content-boundary.test.js` require. They are stored as data in source code,
   not as `.mid` files, so the boundary test stays strict. **Ten now**: the
   first four with step 3, then Hot Cross Buns, Mary Had a Little Lamb,
   London Bridge, Jingle Bells (chorus), Happy Birthday and the opening of
   Für Elise, before Nora's first look. *Melc, melc, codobelc* still waits
   for a checked melody (§10). Every song has **Listen**, which plays it on
   the keyboard (or the phone) before she tries it, at the chosen hands and
   speed, the keys lighting as it goes.
2. **Your own MIDI files**: **Add song** opens a `.mid` from the phone.
   - It stays **on that phone** (IndexedDB), never uploaded, never committed.
   - **“Which part do you want to learn?”**: a short preview of each track, with
     the melody/piano part suggested, and you confirm.
   - A range check against the keyboard's 61 keys (C2–C7), with **melody
     only** and **slower** options for pieces too hard as written.
3. **Not supported:** songs from Flowkey or Simply Piano. Their libraries are
   licensed and locked, and KeyPath won't try to extract them. MusicXML comes
   later, when notation becomes a Journey skill.

---

## 6. Data: local first

- Profiles, progress, settings, imported songs and the engagement log live in
  **IndexedDB on each phone**. No accounts, no server, in the taster.
- KeyPath asks Chrome for **persistent storage** (`navigator.storage.persist()`),
  which is granted more readily to home-screen apps, and checks the answer.
- A **weekly backup nudge**: one tap saves or shares a small file; the app can
  restore from it.
- **Share progress**: like the probe report, a JSON summary Gabriel receives
  on his phone.
- Every record carries a profile id and timestamps, so it can be **uploaded
  as-is** when the family account (`KEYPATH.md` §7, Supabase) arrives.

### The engagement log (what makes the taster an experiment)

Per profile, local only:

| Event | Fields |
|---|---|
| session start / end | time, device |
| door opened | A / B / C / D |
| item started / finished / abandoned | song, step or game; duration; stars; settings in force |
| setting changed | which, from, to |
| suggestion shown / accepted / ignored | e.g. “try Wait for it” |

After **2–3 weeks** the questions are: which door does she open first? Where
does she stay longest? What does she finish, and what does she abandon? Does
she come back the next day? The answers decide whether to deepen A, B, C, D or
a mix.

---

## 7. Out of scope for the taster

Accounts and sync · a content server · notation rendering (beyond a small staff
in a late Journey step) · MusicXML · native Android · the Cabinet/registry
listing (added when stable, per `CABINET.md`).

---

## 8. Open questions

**For Nora** (Gabriel to ask when she's back):
1. What did you like in Simply Piano and Flowkey? What made you stop?
2. Is there one song you'd love to be able to play?
3. Would you rather learn songs, play games, follow a story, or make up your
   own music?

**For later:**
- **Look and feel**: a story or art direction? Her email address hints at
  *Wolfwalkers*. Depends on Nora's answers.
- **Rewards**: stars only, or streaks, collectibles, unlockable Styles? Depends
  on Nora's answers and on the engagement log.
- **MIDI out**: Studio playback and “listen first” in Songs are best played on
  the Yamaha itself. Whether it plays what it receives, in which voices, and
  whether it starts a Style on MIDI Start is untested: the test is built
  (`KEYPATH.md` §3, "Phone → keyboard") and waits for the keyboard. Studio
  was built to work either way.

---

## 9. Build order

Each step ships on its own and is usable without the next.

1. **Engine core, UI-free** — **built** (`src/keypath/engine/`, see below):
   song model, MIDI-file reader, part picker, range check, octave check,
   judge (wait / running, pause-resume), live cues and the end-of-piece
   report.
2. **App shell** — **built** (`src/keypath/app/`, see below): players,
   per-player settings, English/Romanian, local storage with persistence and
   backup, the engagement log, the four-door home. The probe is **Settings →
   Diagnostics**, unchanged: the connection check, event monitor, tests, tempo
   readout, phone-audio check and report.
3. **A. Songs** with the starter pack — **built** (`src/keypath/app/songs/`,
   see below): falling notes, hands, the three wrong-note modes, the end
   report. Plus **Connect the keyboard** (`src/keypath/app/connect/`), a
   step-by-step wizard so nobody reaches a song without a working
   connection.
4. **B. Journey** — **built** (`src/keypath/app/journey/`, see below): the
   six steps with test-out.
5. **MIDI-out probe test**, then **D. Studio** and the “make it yours” link
   from Songs — **built** (see below). The test is ready in Diagnostics and
   **hasn't been run on the Yamaha yet**; Studio works whatever it finds.
6. **C. Challenges**: note race, rhythm echo — **built** (see below); then
   chord catch and the race's “on the staff” mode (see *More challenges*).
7. **Poco F3 check** (`KEYPATH.md` §2) before Nora starts, then two to three
   weeks of use, read the engagement log, and decide what to deepen.
   *Skipped for now at Gabriel's call; still worth doing before she relies
   on it.*
8. **Progress** — **built** (see below): the engagement log read back for a
   parent, and shared as text, so step 7's "read the log" needs no tooling.

### Step 1 as built

```
src/keypath/engine/
  smf.ts        Standard MIDI File reader (formats 0/1, running status, tempo
                map, time signature, track names). No dependency.
  parts.ts      Track+channel parts, a suggested right/left hand (never drums),
                and a Song built from the chosen parts.
  song.ts       The Song model; notes grouped into steps (chords).
  range.ts      Fits the 61 keys? Else the smallest whole-octave move.
  octave.ts     The "press middle C" check → shift for incoming notes.
  settings.ts   Wrong-note mode, timing, report depth, stars; confidence-first
                defaults; timing windows; minimum velocity.
  judge.ts      Wait mode (song holds on each step) and running mode (each
                note judged against its moment; early / on time / late;
                missed). Pause/resume for a dropped keyboard. Listens to the
                player's channels only, via the MIDI layer.
  feedback.ts   Live cues per setting, and the report: stars (finishing
                always earns one), highlights first, bars to work on, and at
                most one suggested step up — never applied automatically.
```

It produces codes, never text: wording in English or Romanian belongs to the
app shell (step 2).

### Step 2 as built

```
src/keypath/app/
  Shell.tsx          who's playing → home → door / settings / diagnostics;
                     sessions start and end with the screen (engagement log)
  router.ts          screens in the URL hash, so the phone's back button works
  store.ts           IndexedDB (idb-keyval) behind an interface; asks Chrome
                     to persist it; everything under keypath:v1:
  profiles.ts        players (name + a face), per-player settings merged over
                     defaults, the player this phone opens into
  log.ts             the engagement log: session start/end, door opened,
                     setting changed, profile created
  backup.ts          save / restore one JSON file; the weekly nudge counts
                     from the first player, never nags on day one
  i18n/              English (default) and Romanian; note names C D E /
                     Do Re Mi / both; a test keeps the two catalogues in step
  screens/           WhoIsPlaying, Home (four doors), DoorScreen (placeholder
                     until each door's step), SettingsScreen, DiagnosticsScreen
```

The doors open to "coming soon", and opening one is already logged. The
probe's own screens stay in English: Diagnostics is a technical tool.

### Celebrations and polish (before Nora's first look)

`src/keypath/app/celebrate/`: `celebrate(moment)` fires confetti in the
doors' colours (canvas-confetti, loaded on demand as in Lexi5) and a haptic
buzz. It's kept for real wins, so they stay special: a song finished (three
stars get a star-shaped burst), a Journey step passed (all six get the
biggest), a new best in Challenges, an echoed rhythm, the keyboard
connected. `useCountUp` counts numbers up (WhereItWent's odometer).

- **Report:** stars pop in one by one, the notes count up, highlights rise
  in turn.
- **Play screen:** a streak counter from five right notes in a row, bumping
  on each, bigger on every ten, and reset quietly by a wrong or missed note.
- **Journey map:** stops rise in, the path fills to how far she's come, the
  open step pulses gently.
- **Challenges:** a "+1" floats up in the race, the note pops in, a new best
  glows.
- **Home:** doors rise in, the avatar floats, and **Pick up where you left
  off** offers the last song (with her best stars) or Journey step. Every
  screen change fades in.

All of it is off under the phone's reduced-motion setting, and in tests.

### More songs and Listen first

Six more public-domain melodies in `engine/starterPack.ts`, provenance in
the file, written from memory: listen to each with **Listen** before
relying on it. Songs with rests or 6/8 time (When the Saints, Row Row Row
Your Boat) wait for rests in the song format. **Listen** plays the song
through Studio's `Playback` on the shared Keyboard/Phone route, and logs
`song_listened`.

### More challenges

- **Note race, on the staff.** A *Show the note* switch on the race's setup:
  *By name* as before, or *On the staff*, where the note is drawn alone on
  a treble staff (the Journey's `Staff`, with a `bare` option: no time
  signature, no bar lines) and has no name anywhere. White keys only, rising
  by level: C to G · C to C · up to the G above the staff. Any octave still
  counts. Its bests are kept apart from the named race (`staff` in the
  records, and in the log's `game`).
- **Chord catch** (`chordCatch.ts`, `ChordCatchScreen.tsx`). A chord is
  named; her three keys must go down together, any octave, any order, and
  each chord is judged by the Journey's own `Chords` exercise, so the
  togetherness window is the same Timing-based one as step 5 (150 / 100 /
  70 ms). Right keys that were too far apart count as *spread* and get an
  “All together!”; the next chord is only asked once every key is up, so the
  hand that just played C isn't read as the start of F. Levels: C, F, G ·
  plus Am, Dm, Em · plus D, E, A (the first black keys). Levels 1 and 2
  light the keys and spell the notes; level 3 gives only the name. 45 s.
  Names follow the note-name setting: C, Am in letters; Do, Lam in solfège.
- Records saved before these existed read back with empty `staff` and
  `chord` tables, so nobody's bests are lost.

### Studio additions

- **Count-in.** *Off · 60 · 80 · 100 · 120*, remembered on the phone. Four
  clicks (a high C on the piano, the first louder, on the keyboard or the
  phone like everything else), and the take starts on the fifth beat. Keys
  played during the count-in aren't recorded, except in its last half-beat,
  which counts as the downbeat played a hair early. Record turns into
  **Cancel** while counting. The take keeps the tempo (`bpm`).
- **Rename.** A take's **⋯** opens its name, its file and Delete. A blank
  name gives it back its number. At most 40 characters.
- **Save as a MIDI file** (`midiExport.ts`, `saveFile.ts`): format 0, one
  track named after the take, her notes and the pedal on channel 1. It is
  written at the count-in's tempo when there was one, so bar lines fall
  where she played them; otherwise at 120 BPM, with exact timing and
  arbitrary bar lines (the screen says which). Chrome's share sheet refuses
  MIDI files (its list of shareable types has no `.mid`, checked in
  Chromium's `share_service_impl.cc` on 2026-09-24), so on Android the file
  downloads to Downloads, and any app can open it from there. Where a
  browser does accept it, the share sheet opens instead.
- In the log: `studio_recorded` gains `countIn`; `studio_renamed` and
  `studio_exported` (shared, cancelled, saved or error) are new.

### Landscape

A phone on its side has about 300–360 px of height, and the playing screens
(a song, a Journey step, the three games) used to push the keys off the
bottom. Under `(orientation: landscape) and (max-height: 560px)`:
- Each playing screen is exactly the screen's height; the falling notes (or
  the prompt) take what's left, and the keys a third of the height
  (`clamp(4.5rem, 34dvh, 8rem)`).
- The title row slims down, and the keyboard's status moves beside it
  (`TopBar`'s `aside`). In portrait it stays on its own line under the title.
- The staff scales down to fit; the race's note and the chord name shrink
  with the height; Rhythm echo puts the Tap pad beside the rhythm.
Portrait is unchanged. Home, Settings and Studio scroll as before.

No full screen. KeyPath runs from a Chrome shortcut on Gabriel's phone (an
install there claims the whole site, `CABINET.md`), and #100 made the first tap
enter full screen to hide Chrome's toolbar. Chrome answers every entry with a
"to exit full screen, drag from the top" toast that no page can suppress, and
it covered the keys, so KeyPath no longer calls `fullscreenOnTap()`. The layout
above is sized for a tab with the toolbar (about 290 px tall on the S24).

### Songs for everyday use

- **Her progress on the song list.** Each song she has played shows her
  best stars from a finished run (★★☆) and when she last played it: today,
  yesterday, or the date (`songs/songProgress.ts`, read from the log).
- **Rename or remove an added song.** Its **⋯** opens the title and Remove,
  which needs a second tap. Removing takes it off the phone for every
  player; the plays already in the log stay, and Progress shows the id where
  the title is gone. Starter songs have no ⋯. New in the log: `song_renamed`,
  `song_removed`.
- **The on-screen keys sound** on the phone (the probe's `SimpleSynth`)
  while no keyboard is connected: a song, a Journey step, the note race and
  chord catch. With the Yamaha connected they stay silent, since she plays
  its keys and it makes the sound. (Studio already played its screen keys.)
- **Three octaves in landscape.** On a phone on its side (the same query as
  the landscape layout), every screen keyboard grows to at least three
  octaves (`widenRange`): an octave at a time, on the side that keeps middle
  C nearest the middle, within the Yamaha's C2–C7. A one-octave song no
  longer gets keys as wide as a hand.

### Audit (2026-09-25), landscape first

A pass over the whole app, with landscape treated as the main way it's used.

**Landscape.** Every setup panel (a song; the three games; Studio's record
bar) shares one layout, `app/setup.module.css`: small segmented controls,
labels beside them, the standard 44 px start button, with the same weights in
both orientations. In portrait each choice is its own row (label above); on a
phone on its side they flow into one row, two at most, so the keyboard stays
in view. Checked at 780×290 (the S24 as a tab) and 780×340 (as an app).
- A song's Stop sits in the corner of the falling notes, not in a row under
  the keys.
- The song report: heading, stars and buttons on the left, the rest on the
  right, so Play again needs no scrolling.
- Home: the four doors side by side. Challenges: the three games side by side.
  The song lists: two columns.
- Studio: tighter spacing; a waiting take is one row (Play, Keep, Discard).
- Rhythm echo: the two-column layout (Tap on the right) only during a turn.

**Bugs fixed.**
- A new screen opened at the previous screen's scroll position; `navigate()`
  now scrolls to the top (back keeps the browser's own restore).
- Leaving a song mid-way with the back arrow wasn't logged; it is now logged
  as stopped, like the Stop button.
- "Another song" went back in history (to Home, from the resume card); it
  opens the song list.
- Leaving Rhythm echo between rhythms wasn't logged as leaving.
- The resume card didn't log opening its door, so Progress undercounted it.
- Import let one part be both hands, doubling every note (`choosePart`).
- A song's keys spanned both hands even when practising one: right-hand Ode
  to Joy drew 22 slivers in portrait, now 8 keys.

**Messages.** Plurals in both languages: `{count|# note|# notes}` in
English, three forms in Romanian (o notă · 5 note · 25 de note; o dată · de
3 ori · de 21 de ori), `pluralIndex` in `i18n/index.ts`, and a test that each
token has a form for every plural its language has. Timing and the end-of-song
report now say what they do. A score of 0 says "None found this time. Have
another go!" rather than "0 found!". Progress shows dates the way people write
them (24 Sep), once when it's a single day.

**Consistency.** Restore asks on the page, like Delete, instead of a browser
dialog. The resume card shows stars as the song list does (★★☆). The
keyboard status sits in the title row on every playing screen, Studio too.
Tap targets: the Connect pill and text links get a finger-sized hit area.

**Small improvements.**
- The song setup says which wrong-note mode and timing are on, with Change.
- "Press middle C" has a way back to change hands or speed.
- A new player's language is chosen on the form, which switches to it at once.
- Settings → Edit name and face.

### Fingers, and practising the hard bars (learning curve, slice 1)

The first slice of §10's "Learning curve", for a player who doesn't know
finger numbers yet. Borrowed from the Hoffman Academy method (numbers taught
inside a hand position), Simply Piano (numbers on the notes) and Flowkey
(looping a hard passage slower); none of their material.

**Journey step 2, "Finger numbers"** (`fingers`, between *Middle C* and
*C, D, E*; the Journey has ten steps now).
- A drawing of both hands, seen from above as they rest on the keys, each
  finger numbered: 5 4 3 2 1 | 1 2 3 4 5 (`journey/Hands.tsx`, SVG by hand).
  It's on the step's first page, and during the practice with the asked
  finger lit.
- The practice: right hand 1→5 on C…G, left hand 5→1 on C…G below, then two
  mixed, each key lit. The check: eight asks from memory, no hands and no lit
  keys, one wrong key allowed.
- MIDI can't say which finger pressed a key, so every ask sits inside the C
  position (right thumb on middle C, left little finger on the C below),
  where a finger names exactly one key. The keys are exact, not by name: E an
  octave up is the wrong finger. So the step asks for middle C first, like
  the tune steps.
- Inserting it moved nothing already done: step ids are strings, and a
  player past later steps just finds this one open (test in
  `progress.test.ts`). Progress now counts ten steps.

**Finger numbers on the notes.** `SongNote.finger` (1–5) where the song has
it. The starter pack writes it per hand as a digit string
(`fingers: { right: '1144554 4433221 …' }`, one digit a note, spaces for
reading), in the simplest positions with a shift where a tune leaves one
(Twinkle's A, Frère Jacques' low G). The Journey's tunes carry it too.
`engine/testing/fingering.ts` checks each: one finger a note, and within a
bar a repeated note keeps its finger and neighbouring keys move the finger
the way the hand goes (the thumb exempt, for crossings). It caught one
misaligned string on the first run.
- The falling notes show the number in a small white circle, above the
  name; a note too short for both shows the number only. The staff shows it
  above the notes in the reading steps' practice, not the check.
- Settings → **Finger numbers on the notes**, on by default for everyone,
  existing players included (a new setting merges over the defaults).
  Simpler than the roadmap's "on while still in the Journey"; Gabriel can
  switch it off for himself.

**Tips in words and numbers**: "Thumb (1) on C, then fingers 2 and 3",
"fingers 1, 3 and 5 (thumb, middle finger, little finger)". The roadmap had
the words dropping once the finger step is passed; they stay for now, since
both together cost nothing and a second set of tips would.

**Practise a bar** (`songs/loop.ts`, pure). Each bar the report names ("Bar 5
is worth another go") gets **🔁 Practise bar 5**, which plays that bar alone
(`barSong`: its notes, moved to start at 0, same ids and fingers) with no
middle-C check, since the octave is already known.
- With a clock (Show it, Keep going) it climbs a ladder, 50% → 75% → 100%,
  one clean pass a rung, never above the speed the song was played at. A
  pass that isn't clean (a missed note or a wrong key) goes round again at
  the same speed after a short break, with its own count-in.
- In **Wait for it** there's no clock to speed up, so one clean pass
  finishes it.
- Done: "Bar 5 is clean!", a cheer, then **Whole song** or **Back to how it
  went**. Stop (or leaving) also goes back to the report.
- The keyboard keeps the song's keys during the loop, so nothing moves under
  her hands.
- Logged as `song_loop` (bar from 1, passes, done, the tempo it ended at);
  Progress counts bars practised and how many came clean.
- Not yet: stepping down a rung after several unclean passes. `passes` in
  the log will say whether she needs it.

### Songs in parts, a short day, the other hand (learning curve, slices 2–4)

Slices 2, 3 and 4 of §10's "Learning curve", in one go at Gabriel's request.

**Songs in parts** (`songs/parts.ts`, pure).
- The way through a song: each new phrase alone, and after each one from
  the second on, everything from the start up to it; then the whole song.
  Ode to Joy is 1, 2, All; Frère Jacques 1, 2, 1–2, 3, 1–3, 4, All.
- A phrase that repeats an earlier one isn't learnt twice: Twinkle (A B B A)
  is 1, 2, 1–2, All, and Au clair de la lune (one line twice) 1, All.
  Compared by pitches and rhythm to the nearest 20 ms, since the same rhythm
  rounds a millisecond apart where beats don't divide evenly.
- The starter pack marks its phrases (`phrases`, start bars). An added song
  is cut every four bars, a last single bar joining the one before. Songs of
  four bars or fewer aren't split.
- A part is played alone, always in **Wait for it**, whatever her setting;
  the whole song is played her own way. A part is learnt with at most two
  wrong keys (one in ten for a long one; missed notes count too). The first
  not learnt is chosen when the song opens.
- After a part: "✓ Part 1 learnt!" and **▶ Part 2**, which starts straight
  away; the middle-C check happens once a visit. Or Again, or Choose a part.
- Learnt per player, per song and per hands (`parts:<player>`): right, left
  and both are learnt separately. Logged as `song_part`; `song_started`
  carries `part`. Progress counts parts played and learnt.
- Setup: a **Parts** row of chips (1, 2, 1–2, All, ✓ when learnt); the Start
  button names the part, and the mode line gives its bars.

**Levels** (`songs/level.ts`). Easy, Medium, Harder on every song in the
list, which is now easiest first. The starter pack says its own (`level`);
an added song is rated from its notes (see "How hard, how long, how many
hands" below). The report offers **Try next:** the easiest song she
hasn't finished, at this song's level or above.

**Today** (`screens/today.ts`, `TodayCard.tsx`), in place of the resume
card. Three things: the song she's on until it has three stars (then the
easiest not finished), the first Journey step not done, and the game she
has played least (equals take turns by the day).
- Picked once a day and kept (`today:<player>`), so the picks don't move as
  she plays; each is ticked off from today's log: a song finished or a part
  learnt, a step practised or checked, a game played through. No streak.
- Opening one logs its door, as the resume card did.
- Landscape: one row above the doors, the items side by side, and the door
  blurbs hidden, so Home still fits a phone on its side.

**Stickers** (`screens/stickers.ts`, `StickerShelf.tsx`). Nine firsts:
first song finished, three stars, finger numbers, a Journey check with no
wrong key, a part learnt, a bar made clean, a new best in a game, a
recording kept, seven practice days (not necessarily in a row). Read from
the log, which only grows, so none is ever taken away. The ones not earned
yet show faintly; tapping one says what it's for, or when it was earned. A
new one is announced once, with a cheer (`stickers:<player>` remembers which
were shown). Below the doors; in landscape a scroll away.

A second batch (2026-09-25, at Gabriel's request) made it twenty, in
roughly the order she'll meet them: first music read from the staff, a whole
song learnt in parts (after learning a part of it), a song with both hands,
a song played in time (finished after a start with a clock), five different
songs finished, a Harder song finished, every Journey step, all five rhythms
of a Rhythm echo round, a song of her own added, a whole Today done, thirty
practice days. Some need more than one record; `earnedStickers` keeps what
the log has shown so far (how each song was started, songs finished, parts
learnt, steps passed, practice days) and is told each song's level. Today
all done is logged once a day (`today_done`) when Home first sees it.

A third batch made it twenty-three: three months, six months and a year of
practice. Unlike the week and the thirty days (days she played, counted),
these count calendar time: she practises on a day at least that long after
her first practice day (three months after 31 January is 30 April).

**The other hand plays itself** (`songs/accompany.ts`). With a two-handed
song and one hand chosen, the other hand's notes sound, on by default and
remembered on the phone (chip **🎹 Other hand** beside Hands).
- With a clock (Show it, Keep going) the notes are handed over a little
  ahead, at their moments; a note whose moment passed during a pause is
  skipped, not played late.
- In Wait for it, each step she plays lets the other hand carry on up to her
  next step, in the song's rhythm from that moment.
- Through the keyboard when it takes MIDI, as Studio's takes and Listen do
  (channel 1), otherwise the phone. On the Yamaha this is untried until the
  MIDI-out test; if the keyboard sends the notes back, a note arriving within
  80 ms of one sent at that pitch is taken as the echo and never judged.
- Loops of a bar play the other hand too.

**Audit of the day's work (2026-09-25, landscape first).**
- The middle-C check is asked once a visit: Start, Play again and Whole song
  go straight in once it's known, and it's asked again only if a keyboard is
  plugged in or out (it may be set to another octave).
- Whole song after a practised bar started the bar again, not the song.
- A song with more than seven parts steps through them (‹ Part 3 · 5 of 17 ›)
  instead of a wall of chips.
- The finger-numbers intro puts the hands beside the words in landscape,
  so its buttons stay in view. The Journey map is two columns in landscape.
- Finishing the whole song no longer earns "a part of a song learnt", nor
  counts as a part in Progress. Several new stickers at once are counted
  ("3 new stickers!") rather than one named.
- The other-hand chip says **🎹 Other hand** (Romanian: Cealaltă mână), so
  a two-handed song's setup stays on two rows in either language; its full
  meaning is its accessible name.
- Today's song gets the widest column in landscape; song titles are longest.

**Rhythm syllables.** Rhythm echo's dots say ta or ti, the Kodály way
Hoffman teaches: a note on the beat lasting a beat or more is ta, a half
beat or one off the beat is ti. The setup line says to speak them.

### Songs wider than the keyboard

An added MIDI file can reach past the PSR-E383's 61 keys (C2–C7, MIDI
36–96). Before, a song that could be moved by whole octaves was moved
silently, and one too wide for that kept its notes past the keys: they
weren't drawn and couldn't be pressed, so in **Wait for it** the song stopped
for good at the first one, and with a clock they only ever counted as missed.

Now each way of fitting it has a cost, so it's a choice (`engine/range.ts`,
`songs/FitChoice.tsx`), offered when a song is added and again from its ⋯
menu in the song list:
- **Move the whole song** by whole octaves: it sounds the same, lower or
  higher. Offered only when the song spans 61 keys or fewer. The default
  when it's offered.
- **Move each hand on its own**, by whole octaves each: offered instead when
  the song as a whole is too wide but each hand fits. Each hand keeps its
  shape; the gap between them changes.
- **Move only the notes that don't fit**, each by the fewest octaves onto
  the keys; the rest stay as written. Those notes jump out of line. A moved
  note landing on a key already starting at that moment is left out rather
  than pressed twice, so when *every* stray note would land that way (a bass
  line doubled in octaves), this choice is the same as the next one and isn't
  offered.
- **Leave out the notes that don't fit**; nothing else changes.

The default depends on how many notes are outside. Under 5% of the song
(`FEW_OUTSIDE`: say five low bass notes in three hundred), only those move,
so the rest stay where the composer wrote them rather than the whole
song dropping an octave; or, if moving them would only double keys already
sounding, they're left out. At 5% or more the song is simply in the wrong
place, and the first choice above is the default (`defaultFit`).

Each choice says what it would change ("3 notes move an octave or two…").
Moves are always whole octaves, so the key never changes.

The notes as written are kept with the song (`Song.source`), and `fit` names
the choice, so it can be changed later without adding the song again. Bars
don't change, so parts already learnt stay learnt. A song added before this
existed, with notes past the keys, is given the default choice when it's
read, so none can get stuck.

### Both hands in one track

Many piano MIDI files put both hands in one track. Imported as it was, all of
it went to the right hand: Practise hands never had a left hand to offer and
Other hand plays did nothing.

When there's no left-hand part, the right-hand part is checked for two hands
(`suggestSplit`, `engine/parts.ts`): a real share of notes below and above
middle C, and enough of them struck together. A plain melody isn't offered a
split. When it looks two-handed, "Split this part between two hands" is on,
with the line where the hands part: tried at each key from F3 to C5, it's the
one that cuts fewest chords (notes a fifth or less apart, struck together)
and leaves fewest reaches over an octave for one hand, drawn toward middle C
on a tie. For a waltz with the bass low and chords under the tune, it lands
between the chord's top and the tune. She can move the line or switch the
split off, with a count of how many notes each hand gets. The split comes
before the fit to the keyboard, so each hand is then fitted as a hand.

A split by pitch is a guess: where the hands cross, a note goes to the wrong
one. Choosing a left-hand part turns the split off.

### Songs from a score (MusicXML)

**Add a song** takes MusicXML as well as MIDI: `.mxl` (compressed, what
MuseScore offers as its MusicXML download), `.musicxml` and `.xml`. Gabriel
gets songs from MuseScore and prefers the score, because it says what MIDI
only lets us guess:
- **The hands.** A piano's two staves are the two hands: the top staff is
  offered as the right hand, the one below as the left (`suggestScoreParts`),
  and the parts read *Piano · upper staff*, *Piano · lower staff*. No split
  is offered, since the hands are already apart.
- **Finger numbers**, where the score prints them (`<fingering>`), on the
  falling notes like the starter songs'. A MIDI file still shows none.
- **The bars as printed.** Repeats and first and second endings are written
  out in playing order, and each bar keeps its printed number
  (`Song.barLabels`): "Bar 12 is worth another go" is bar 12 on the page,
  and a part reads "Bars 5–8", or "Bars 7–8, 5–6" where it runs over a
  repeat (`barName`, `barSpan`). A pickup is a short bar of its own.
- **Rhythm as written**: note values and tempo marks, not a recording's
  timing. Ties become one held note.

How (`engine/xml.ts`, `engine/mxl.ts`, `engine/musicxml.ts`): a small XML
reader of our own, since the engine runs without a DOM; the `.mxl` zip read
with the browser's own `DecompressionStream`, so no zip library joins the
bundle; the score read into the same shape as a MIDI file (`SmfFile`, with a
`score` field for what MIDI can't carry), so it goes through the same steps:
which part, fit, level. Notes sound for 90% of their value, as in the
starter pack. Left out on purpose: grace notes (too quick to wait for), cue
notes (not played), D.C./D.S./Coda/Fine jumps (their bars play once, in
order), ornaments and dynamics. Timewise scores (rare) are refused.

The file picker has no type filter: Android doesn't know `.mxl` and would
grey MuseScore's download out. The file is read to tell what it is, and
anything else gets "That file isn't a MuseScore, MusicXML or MIDI file."

### Songs from MuseScore (.mscz)

MuseScore's MusicXML download needs its paid plan; its own `.mscz` files
don't. So **Add a song** reads those too, and `.mscx` (the same score,
uncompressed). An `.mscz` is a zip like `.mxl`: `META-INF/container.xml`
names the `.mscx` inside, and without a container the score beside
`Excerpts/` is taken (`engine/mxl.ts`).

`engine/mscx.ts` reads MuseScore 2, 3 and 4 into the same bars as a MusicXML
score, and `fileFromParts` (in `engine/musicxml.ts`) lays both out in time,
so both formats get the same repeats, endings, ties, tempo map, printed bars
and fingers. What differs by version:
- **voices**: 3–4 give each its own `<voice>`; 2 writes the first, then a
  `<tick>` back to the bar's start and `<track>` on the next voice's chords;
- **tuplets**: 3–4 put a `<Tuplet>` before its notes and `<endTuplet/>`
  after; 2 defines `<Tuplet id>` and each note names it;
- **ties**: 3–4 put `<Spanner type="Tie">` with a `<next>` on the first note;
  2 puts a `<Tie>` in it. Either way the next note of that pitch in that
  voice is joined on;
- **endings**: 3–4 use `<Spanner type="Volta">` saying how many bars it
  lasts; 2 opens `<Volta id>` and closes it with `<endSpanner id>`;
- **bar numbers**: 2 writes them; 3–4 are counted, an irregular bar (a
  pickup) not counting, as MuseScore prints them.

Pitches are stored as they sound, so a transposing instrument needs nothing.
Tablature and percussion staves are left out. The rest (grace notes, jumps,
dynamics) is as for MusicXML.

**How it was checked.** `webmscore`, MuseScore compiled to WebAssembly, was
run outside the repo as an oracle; it is 24 MB, too heavy to ship, and
never joins the bundle. On a real MuseScore 2.06 file (a 100-bar two-hand
piano arrangement) and on the same file saved as MuseScore 4, every one of
its 1468 notes matched MuseScore's own MIDI export in pitch and start. A
test score with a pickup, repeat and endings, tie, triplet, second voice,
chord and tempo change matched too, except the grace note MuseScore plays
and KeyPath leaves out on purpose. The tests (`engine/mscx.test.ts`) use
small hand-written scores laid out as each version writes them.

**The Parts row for a long song.** A song with more than seven parts used to
step through them one at a time (‹ Part 3 · 3 of 29 ›), and a CSS rule meant
for count-in rows stretched the ‹ across the panel. Now every song has the
same chips; a long song's run on one line that scrolls sideways, the chosen
chip brought to the middle.

### How hard, how long, how many hands

Every song in the list now reads, under its title, *Easy · Two hands · 0:32*:
its level, whether it has notes for one hand or both, and its length at its
own tempo (`songs/SongFacts.tsx`). The hands were a 🖐/🖐🖐 and the length
was "32 s" at the far right of the row; neither read as a marker.

**The rating** (`songs/level.ts`). An added song's level used to come from a
count (notes a second, overall spread, black keys, chords, two hands) that
agreed with the starter pack's hand-set levels on only four of ten songs; it
called Happy Birthday Easy. It now scores what each hand is asked to do, as
the starter levels were set, and takes the harder hand:
- reach: a hand's lowest to highest key past a sixth (+1), past two octaves (+2);
- jumps between one note or chord and the next (the top note for the right
  hand, the bottom for the left): past a fifth (+1), an octave or more (+2);
- speed at the written tempo: at least 5% of the gaps under 320 ms (+1),
  under 200 ms (+2), so a few grace notes don't count;
- black keys over 10% of the notes (+1); chords in a hand (+1);
- a left hand that keeps pace with the tune, three notes to its four or more
  (+1): a waltz's bass and chords count, Twinkle's slow roots don't.

0 points is Easy, 1–3 Medium, 4 or more Harder. `level.test.ts` rates every
starter song with its level hidden and requires its own level back, so the
two scales can't drift apart.

**Setting it.** At import, under *This song* (hands, length), *Level* shows
the rating and lets her pick another; the same is in the song's ⋯ menu. A
level equal to the rating isn't stored, so the rating follows later changes
(a different fit, say); one that differs is kept as `Song.level`, and
survives a refit. Built-in songs keep theirs.

### Progress (after step 6)

```
src/keypath/app/progress/
  summary.ts         the log read back as the taster's questions: days
                     played, sessions and minutes, "came back the next day",
                     per door how often it was opened, opened first, and
                     roughly how long she stayed; songs finished, stopped
                     and started, song by song with best stars; Journey
                     checks, Challenges played, Studio takes; suggestions
                     accepted or not; settings changed; the keyboard lost
                     mid-song
  ProgressScreen.tsx Settings → Progress: one player at a time (a switcher
                     when there are several), and Share progress… / Copy,
                     which send the same numbers as a small JSON text, plus
                     Journey steps, Challenge bests and the number of kept
                     takes. Titles, not ids, for songs. No recordings, no
                     song files
```

Time per door is an estimate, and the screen says so: the log records
opening a door, not leaving it, so a door's time runs until the next door or
the end of the session, time back on Home included.

### Step 6 as built

```
src/keypath/app/challenges/
  noteRace.ts        a name is shown; any key with that name counts, in any
                     octave; a new, different name each time; 30 s. Levels:
                     C to G · white keys · all keys (black keys named ♯)
  rhythm.ts          five one-bar patterns per level (steady quarters ·
                     eighths · off the beat); a turn is four clicks, the
                     rhythm, four clicks, her bar; judgeEcho matches each
                     note to the nearest tap within a window from the Timing
                     setting (140 / 100 / 65 ms), marks on time / early /
                     late / missed, and passes with every note played and at
                     most one stray tap
  records.ts         each player's best per game and level
  ChallengesHome.tsx the door: every game, with bests
  NoteRaceScreen.tsx the race; the screen keys lose their names here, since
                     finding the key is the game
  EchoScreen.tsx     the echo: a KeyPath row and a You row, a playhead, marks
                     after each turn; Again or Next; a round of five
```

Rhythm echo plays through Studio's `Playback`, on the keyboard (MIDI out)
or the phone. The Keyboard/Phone choice is now shared by Studio and
Challenges (`studio/output.tsx`). Clicks are a high C and the rhythm a C
an octave lower, both on the piano, so no drum channel is assumed before the
MIDI-out test has been run. Taps before her bar (the rhythm itself, or the
keyboard echoing it back) are ignored.

With all four doors built, the "coming soon" placeholder is gone.

New in the engagement log: `challenge_started`, `challenge_finished` (score,
whether it beat the best, wrong keys for the race) and `challenge_left`.

### Step 5 as built

```
src/keypath/midi/          outputs listed in the connection snapshot, and
                           send(bytes, at) to the Yamaha (preferred if several
                           outputs), scheduled on Web MIDI's own clock
src/keypath/probe/midiOut.ts + components/MidiOutPanel.tsx
                           the MIDI-out test in Diagnostics (KEYPATH.md §3,
                           "Phone → keyboard"): four notes, another voice, a
                           Style started from the phone; plus an automatic
                           echo check. Answers go into the report
src/keypath/app/studio/
  recorder.ts              her notes and sustain pedal from channels 1–8,
                           never the Style's channels; ten minutes at most
  playback.ts              plays a take through a sink, handing events over
                           250 ms ahead with their exact time, so timing
                           doesn't depend on timers and Stop leaves at most
                           that much in flight
  sinks.ts                 the keyboard (MIDI out, channel 1; Stop silences
                           twice, now and after the lookahead) or the phone
                           (the probe's synth; through the "sound through the
                           keyboard" level when the Yamaha is attached)
  takes.ts                 kept takes per player, numbered, favourites; at
                           most 50, and never dropped silently
  StudioScreen.tsx         Record / Stop, keep or discard, my takes (play,
                           ★, delete on a second tap), play takes on
                           Keyboard or Phone. Opened from a song's report as
                           "Make it yours", with the song's tune as a
                           reminder and the take named after it
```

**What Studio records is what she plays, not the Style.** The Style's notes
arrive on channels 9–16 and are left out. At playback the keyboard doesn't
restart the Style, so she hears her part alone unless she starts the Style
herself. Whether the app could start it (MIDI Start) is test 3 above. If
the Yamaha turns out not to play what it receives (test 1), set "Play takes
on" to Phone. The choice is remembered per phone.

Takes can't be exported yet, and nothing leaves the phone except in the
backup file, like everything else.

New in the engagement log: `studio_opened` (from the door, or from a song),
`studio_recorded` (length, notes, whether a Style ran), `studio_kept`,
`studio_played` (on the keyboard or the phone), `studio_favourite` and
`studio_deleted`.

### Step 4 as built

```
src/keypath/app/journey/
  steps.ts           the six steps (practice with keys lit, check with keys
                     dark), their keyboards, pass marks, and which need the
                     middle-C check. Tunes are public domain, stored as data:
                     Ode to Joy, Twinkle, Mary Had a Little Lamb
  exercises.ts       one small judge per kind of task, free of React:
                     Prompts (one named key at a time), FindAll ("three
                     different Cs"), Chords (all keys within a window from
                     the Timing setting: 150 / 100 / 70 ms; spread wider is
                     "nearly", not wrong), Tune (the engine's judge in
                     "Wait for it")
  progress.ts        per player: which steps are done, and how (in order, or
                     tested out)
  JourneyHome.tsx    the map: six stops on a path
  StepScreen.tsx     intro and tip → Learn it / Check (or "I can do this
                     already" on a locked step) → middle C where needed →
                     the exercise → result, with the next step one tap away
  Staff.tsx          a small treble staff in SVG for step 6, drawn by hand
                     (no notation library for one step); the clef is a
                     drawn stroke, not the 𝄞 character, which Android's
                     fonts may lack
```

| # | Step | Practice (keys lit) | Check (keys dark) |
|---|---|---|---|
| 1 | Find middle C | middle C, the C above, the C below, middle C | three different Cs |
| 2 | C, D, E | C D E D C E D C | D C E D E C, by name |
| 3 | A five-finger tune | Ode to Joy, first line | the same line |
| 4 | Your first chord | C, C, G, G chords | C, G, C chords |
| 5 | Both hands | Twinkle, first line, with seven low left-hand notes, each starting with a right-hand note | the same |
| 6 | Reading music | two bars on the staff, named: C D E F G F E D | Mary Had a Little Lamb, first bar and a half, unnamed |
| 7 | Left hand | Ode to Joy's first line an octave down, in the left hand | the same |
| 8 | The black keys | the five sharps, lit | six sharps by name, any octave |
| 9 | Reading higher | the staff from C up to the next C, named (stems down from the middle line) | Twinkle's opening, unnamed |

Steps 7–9 were added before Nora's first look, from the "more steps" list.

Steps 1, 2 and 4 go by note *name* (any octave), so they need no octave
check. The tune steps start with "press middle C", like Songs.

**Passing a step's check is what completes it.** A locked step's check can be
taken at any time ("I can do this already"). Passing it completes **that step
only**, since each step proves its own skill (reading a staff says nothing
about chords). The map then shows it as "Tested out", and the first step not
yet done stays open. Practices always finish; they teach, and don't count.

New in the engagement log: `journey_started` (practice or check, and whether
it was a test-out), `journey_finished` (passed, wrong keys, time) and
`journey_left`.

### Step 3 as built

```
src/keypath/engine/starterPack.ts
                     four public-domain melodies as data (no .mid files, so
                     content-boundary.test.js stays strict): Twinkle and Ode
                     to Joy with a simple left hand, Frère Jacques and Au
                     clair de la lune right hand only. Provenance in the file
src/keypath/app/songs/
  library.ts         the starter pack + the family's own songs (IndexedDB,
                     shared by every player on the phone); "Add a song" reads
                     a MIDI file, suggests the hands, moves it by whole
                     octaves to fit the 61 keys and says so
  SongsHome.tsx      the Songs door: starter songs, your songs, Add a song
  ImportSong.tsx     pick a file, confirm which part is which hand, save
  PlayScreen.tsx     hands and speed (100/75/50%) → "press middle C" (the
                     octave check) → play → report. Running mode counts in
                     three beats; wait mode glides to the next step. Pauses
                     when the keyboard drops or the app leaves the screen
  FallingNotes.tsx   one transform per frame, no React re-render per frame
  PlayKeyboard.tsx   full-width keys lined up with the notes; always
                     playable by touch, so a song works without the Yamaha
  keyGeometry.ts     key positions as percentages
  ReportView.tsx     stars, what went well first, the bar worth another go,
                     and the step-up suggestion (only applied on "Yes")
src/keypath/app/connect/
  keyboard.ts        the one tutor-wide Web MIDI connection. Opens by itself
                     only when Chrome already allows it: the permission
                     prompt is only ever raised from the wizard, explained
  setup.ts           the wizard's steps as pure logic (tested on its own)
  ConnectWizard.tsx  Browser → OTG (Xiaomi/Redmi/POCO only) → Plug in →
                     Allow → Find the keyboard → Press any key. Each step is
                     checked before the next opens; steps it can already see
                     are done are skipped. Find shows what to check after 6 s
                     and keeps listening, so plugging in moves it on by itself
  KeyboardStatus.tsx the live "Keyboard ready / not connected · Connect" line
                     on Home and above every song
  remember.ts        this phone's keyboard, so Home shows a "Connect your
                     keyboard" card until the first success
```

New in the engagement log: `song_started`, `song_finished`, `song_abandoned`,
`song_added`, `suggestion` (accepted or not), `keyboard_setup` (done, or the
step someone gave up on), and `keyboard_lost` mid-song. On the Poco F3 that
last one is the signal for Xiaomi's OTG timeout.

A keyboard pulled out mid-song pauses the song. "Help me reconnect" opens the
wizard; when the keyboard is back the banner says so and Carry on resumes
where it stopped.

The wizard's detection is tested in happy-dom against a fake connection, and
in Chromium against a fake Web MIDI device injected at `requestMIDIAccess`,
which runs the real `WebMidiConnection`, hot-plug included. **It hasn't met
the real Yamaha yet**: first thing to try on the S24.

---

## 10. Roadmap: deferred on purpose

Left out of the steps above to keep each one small. Nothing here is
forgotten; each item says when it comes back.

**Learning curve** (next, in this order; from reading Flowkey, Simply Piano
and the Hoffman Academy method, 2026-09-25). The gap it closes is between
"I can play five notes" and "I can play a whole song". Nora doesn't know
finger numbers yet, so they come first. Borrowed: methods only. Hoffman's
songs, videos and sheet music are copyrighted and stay out, like any other
copyrighted music.

1. ~~**Fingers, and practising the hard bars**~~ Done (§9, "Fingers, and
   practising the hard bars"), with two simplifications noted there: the
   numbers are on for every player, and the tips keep their words.
   - **A Journey step, "Your fingers have numbers"**, between *Middle C* and
     *C, D, E*. Thumb = 1 on both hands, and the hands mirror: right thumb on
     middle C, left little finger (5) on the C below. Then a game: "Right
     hand, finger 3!" and she presses E. MIDI can't say *which finger*
     pressed a key, so every question is set inside a fixed hand position,
     where the finger names exactly one key. That's how Hoffman teaches it
     too: numbers and the hand position together. Step ids are strings and a
     step already done stays done, so inserting it only opens it for a player
     who has passed later steps; it blocks nothing.
   - **Finger numbers on the notes**, falling and on the staff, switchable in
     Settings, on by default for a player who is still in the Journey.
     Fingering is written by hand for the starter songs, as data beside the
     melodies. Imported songs show none: no number is better than a wrong
     one.
   - **Tips in words and numbers** ("thumb (1), middle finger (3)"). The words
     drop once the finger step is passed, as Hoffman drops them.
   - **Loop the tricky bars, with a speed ladder.** The report's "Bar 5 is
     worth another go" becomes a button that loops that bar at 50%; each
     clean pass steps up (50 → 75 → 100%), then it's back to the whole song.
2. ~~**Songs in parts**~~ Done (§9, "Songs in parts, a short day, the other
   hand"). Levels are words (Easy, Medium, Harder), not stars, since stars
   already mean her score:
   - A song opens as phrase 1, then phrase 2, then both together, each
     passed in *Wait for it* before the next opens.
   - A difficulty mark on every song (★ to ★★★), and a "try next" after each
     finished one.
3. ~~**A short day**~~ Done (same section). Today replaced Home's resume
   card:
   - A **Today** card on Home: one song part, one Journey step, one quick
     game, picked from her log and done in about five minutes. Shown as a
     checklist, like the practice list after a Hoffman lesson. No streak to
     break; a missed day costs nothing.
   - **Stickers** for firsts (first song finished, first three stars, first
     step passed without help, a week of practice days), kept on her Home and
     never taken away.
4. ~~**Later**~~ Built with 2 and 3, at Gabriel's request (same section):
   - **The other hand plays itself** while she practises one. On the phone it
     works today; on the Yamaha it waits on the MIDI-out test.
   - **Rhythm syllables** (ta, ti-ti), from Kodály via Hoffman, under the beats
     in Rhythm echo instead of counting.

Left out on purpose: a video of a pianist (Flowkey), a big pop library
(Simply Piano: copyrighted, and **Add a song** is the route for those),
streaks that can break, singing in solfège (Hoffman's first lessons: the app
only hears the keyboard; *Listen first* and Echo cover "sound before
symbol"), and long video lessons. Hoffman's own videos are free to watch and
make a fine companion: its finger-numbers lesson once, then the practice here.

**App shell refinements** (deferred from step 2):
- A **PIN** on a player (the family-account design in `KEYPATH.md` §7). For
  now each phone simply opens into its last player.
- ~~**Edit a player**~~ Done (§9, "Audit"). *Remove* is done too: Settings →
  **Delete this player**, confirmed in place. It deletes every key ending in
  the player's id (settings, log, Journey, Studio), and keeps the phone's
  songs, the other players and the keyboard it remembers.
- ~~**Share progress**~~ Done: Settings → Progress (§9, "Progress").
- ~~**Leaving a door**~~ Done: `door_left` is logged when she's back on
  Home (a detour to Settings or the connection wizard still counts to the
  door), and Progress stops the door's time there.
- Translating the **Diagnostics** screen, which stays in English for now.

**App distribution** — **done** (after step 5, at Gabriel's request, to
install it and get the full screen):
- Listed on the front page (`index.html`) and in The Cabinet, via
  `src/apps-registry.js` (`CABINET.md` checklist).
- PWA: `public/keypath.webmanifest` (standalone, any orientation), icons from
  `public/keypath-icon.svg` / `keypath-logo.svg` via `npm run
  gen:keypath-icons`, a scoped service worker (`public/keypath-sw.js`,
  production only; navigations network-first, so the installed app opens
  the latest deploy when online), and `watchInstalled('keypath-react.html')`.
- The screen stays on across the whole tutor (wake lock in `Shell.tsx`).

**Engine refinements** (after Nora has used the taster; tune on her playing):
- **Note length.** Only note *starts* are judged. Holding a note for its full
  value isn't scored yet.
- **Chord togetherness.** In running mode each chord note is judged against
  its own window. The probe's 60–80 ms "together" window isn't applied as a
  separate check yet.
- **Dynamics.** Velocity is only used to ignore grazed keys. Loud/soft isn't
  judged.
- **Following the keyboard's tempo** (MIDI Clock) instead of the app's own.
- **Hand from the Split channel**: using channel 3 as "left hand" when Split
  is on.
- **Import simplification**: "melody only" for arrangements too hard as
  written; it could become a fifth way in the choice for songs wider than
  the keyboard (§9, "Songs wider than the keyboard").
- ~~**MusicXML import**~~ Done (§9, "Songs from a score"), and MuseScore's
  own `.mscz` (§9, "Songs from MuseScore"). Still open:
  **notation rendering** of a song's score (a late Journey skill), and the
  D.C./D.S./Coda jumps.

**Challenges refinements** (deferred from step 6):
- **Audio latency.** When the rhythm plays on the phone, she hears it about
  25 ms+ late (Chrome's output latency on the S24) and taps to what she
  hears, so taps read slightly late. The keyboard route has no such lag.
  Compensate with the AudioContext's `outputLatency` once measured on her
  phone.
- **A drum sound** for the clicks (General MIDI channel 10), if the MIDI-out
  test shows the Yamaha plays it.
- **More games**, if the log says Challenges is her door: intervals by ear,
  a longer race. (Chords by name is done: chord catch, §9 "More
  challenges".)

**Studio refinements** (deferred from step 5; most depend on the MIDI-out test):
- **Start the Style with playback**, if test 3 says the keyboard obeys MIDI
  Start: record the Style's tempo (MIDI Clock) with the take and start it
  in time. Today she starts it herself.
- ~~**"Listen first" in Songs**~~ Done (§9, "More songs and Listen
  first"). Still open: a second voice for it, if test 2 allows.
- ~~**Export a take** as a `.mid` file~~ Done (§9, "Studio additions").
  Still open: opening a take in Songs as her own song, which needs her free
  timing snapped to beats first.
- ~~**Rename** a take~~ Done (§9, "Studio additions").
- ~~**A metronome during the take**~~ Done: with a count-in chosen, **♩ Keep
  clicking** carries the click on every beat of the take (the first of each
  bar louder), remembered on the phone (`studio/metronome.ts`). A click the
  keyboard might send back is recognised by its key and moment and never
  recorded. Logged as `click` on `studio_recorded`.
- **The phone's playback ignores the sustain pedal.** Notes end where the
  keys were released; the keyboard's playback does voice the pedal. Parked:
  there is no pedal (a footswitch, FC5 or FC4A, in the SUSTAIN jack), so no
  take has any. Comes back if one is bought.

**Journey refinements** (deferred from step 4; tune on Nora's use):
- **Pass marks.** A check passes with at most one wrong key (two in the tune
  steps). Checks have no time limit: "about 30 s" is how long they take, not
  a clock. Both are guesses until the log shows how she does.
- ~~**Reading step:** key names during the check~~ Done: a **Names on the
  keys** setting, offered off after step 6 (§2, "The ramp").
- **More steps**: rests and a second line of notation (the left hand, the
  black keys and reading higher are done, steps 7–9), once the log says the
  Journey is the door she uses.
- **Chord togetherness** is judged in the chord step only. The engine's
  Songs judging doesn't use it yet (see Engine refinements).

**Songs refinements** (deferred from step 3):
- ~~**Remove or rename** an added song~~ Done (§9, "Songs for everyday use").
- ~~**Progress per song** on the song list~~ Done (same section).
- **More starter songs.** "Melc, melc, codobelc" was left out: its melody
  hasn't been checked against a reliable source yet.
- ~~**Landscape layout**~~ Done: it fits, and shows three octaves (§9,
  "Landscape" and "Songs for everyday use").
- ~~A **sound for the on-screen keys**~~ Done (same section).
- **Make a song from a recording.** A tune recorded on the phone (played,
  or hummed) turned into a song in her library. Like **Add a song**, it
  stays on the phone and never reaches the repo. The candidate is Spotify's
  Basic Pitch (`@spotify/basic-pitch`, Apache 2.0): audio to MIDI, any
  instrument, chords included, with a model of about 0.9 MB. Checked
  2026-09-24:
  - It transcribes a **whole recording**, not live, so it's no route to a
    "no keyboard" mode.
  - Its last release (1.0.1) is from August 2022, and it needs TensorFlow.js
    3, a major version behind. Load it only when this feature opens, never in
    the main bundle (the deploy-size rules in `CLAUDE.md`).
  - The model is the easy part. The work is the cleanup: extra notes from
    overtones, repeated notes merged, no hands split, and times that must be
    snapped to beats before the engine can use them. So it needs a review
    screen to fix the notes before the song is saved.
  - Not for the playing itself: over USB the Yamaha already sends exact
    notes, and transcription would only add guesses.

  Comes back once the log shows she uses **Add a song** (`song_added`).

**Connection refinements** (deferred from step 3):
- A check for **Touch Response Off** (every note at the same velocity). It
  doesn't matter until dynamics are judged.
- The wizard doesn't test the **charging hub** (`KEYPATH.md` §2) or phone
  audio; Diagnostics still does the audio check.

**Content**: the public-domain starter pack, four melodies with step 3 and
ten since "More songs and Listen first". More public-domain pieces can join it
the same way, as data.

