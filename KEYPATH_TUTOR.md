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
| On a wrong note | **Keep going** (nothing live; report at the end) · **Show it** (wrong key flashes, song continues) · **Wait for it** (song pauses until the right note) | Show it |
| Timing | Relaxed (wide window; early/late never counts against) · Normal · Strict | Relaxed |
| End-of-piece report | Off · Short (stars + one “try this next”) · Detailed (which bars/notes, early/late) | Short |
| Wrong notes affect stars | Yes · No | No |
| Sound through the keyboard | 0–100 (the probe's control) | 0 |

Reports lead with **what went right** before any correction.

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
| **C. Challenges** | Two games: **note race** (find the key shown, against the clock) and **rhythm echo** (KeyPath plays a rhythm, you copy it) | Rhythm/party games |
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
   not as `.mid` files, so the boundary test stays strict. **Shipped with
   four** (step 3); *Melc, melc, codobelc* waits for a checked melody (§10).
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
6. **C. Challenges**: note race, rhythm echo.
7. **Poco F3 check** (`KEYPATH.md` §2) before Nora starts, then two to three
   weeks of use, read the engagement log, and decide what to deepen.

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

**App shell refinements** (deferred from step 2):
- A **PIN** on a player (the family-account design in `KEYPATH.md` §7). For
  now each phone simply opens into its last player.
- **Edit or remove a player**. For now: create and switch.
- **Share progress** as a report to a parent's phone, alongside the backup
  file.
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
  written (the range check and whole-octave transposition exist now).
- **MusicXML import** (with notation rendering, a late Journey skill).

**Studio refinements** (deferred from step 5; most depend on the MIDI-out test):
- **Start the Style with playback**, if test 3 says the keyboard obeys MIDI
  Start: record the Style's tempo (MIDI Clock) with the take and start it
  in time. Today she starts it herself.
- **"Listen first" in Songs**, the song played by the Yamaha before she
  tries it, in a second voice if test 2 allows.
- **Export a take** as a `.mid` file, to share or to open in Songs as her
  own song.
- **Rename** a take. For now they're numbered, or named after the song.
- **The phone's playback ignores the sustain pedal.** Notes end where the
  keys were released; the keyboard's playback does voice the pedal.

**Journey refinements** (deferred from step 4; tune on Nora's use):
- **Pass marks.** A check passes with at most one wrong key (two in the tune
  steps). Checks have no time limit: "about 30 s" is how long they take, not
  a clock. Both are guesses until the log shows how she does.
- **Reading step:** the keyboard still shows note names during the check, so
  she reads staff → name → key rather than staff → key. Hide them once she's
  past it, as a setting.
- **More steps** (rests, the left hand alone, a black key, a second line of
  notation) once the log says the Journey is the door she uses.
- **Chord togetherness** is judged in the chord step only. The engine's
  Songs judging doesn't use it yet (see Engine refinements).

**Songs refinements** (deferred from step 3):
- **Remove or rename** an added song. For now songs can only be added.
- **Progress per song** (best stars, last played) on the song list. The log
  already has what's needed.
- **More starter songs.** "Melc, melc, codobelc" was left out: its melody
  hasn't been checked against a reliable source yet.
- **Landscape layout** for the play screen: more keys, more width per key.
- A **sound for the on-screen keys** when no keyboard is connected (the
  probe's synth, through the output level that defaults to 0).

**Connection refinements** (deferred from step 3):
- A check for **Touch Response Off** (every note at the same velocity). It
  doesn't matter until dynamics are judged.
- The wizard doesn't test the **charging hub** (`KEYPATH.md` §2) or phone
  audio; Diagnostics still does the audio check.

**Content**: the public-domain starter pack shipped with step 3 (four
melodies). More public-domain pieces can join it the same way, as data.

