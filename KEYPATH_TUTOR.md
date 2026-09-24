# KeyPath — tutor design (v0 “taster”)

The design of the learning app that follows the probe (`KEYPATH.md`). Nothing
here is built yet. The hardware questions are answered in `KEYPATH.md` §1;
this document is about **what Nora does with it**.

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
   not as `.mid` files, so the boundary test stays strict.
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
  the Yamaha itself (it accepts MIDI on 16 channels). This needs one short probe
  test before building Studio.

---

## 9. Build order

Each step ships on its own and is usable without the next.

1. **Engine core, UI-free**: song model, MIDI-file import (tracks, part
   picker, range check), judge, feedback policy, tested like
   `probe/diagnostics.ts`.
2. **App shell**: profiles, per-profile settings, English/Romanian strings,
   IndexedDB storage with persist + backup, engagement log, the four-door home.
   The probe becomes a **Diagnostics** screen inside it.
3. **A. Songs** with the starter pack: falling notes, hands, the three
   wrong-note modes, the end report.
4. **B. Journey**: the six steps with test-out.
5. **MIDI-out probe test**, then **D. Studio** and the “make it yours” link
   from Songs.
6. **C. Challenges**: note race, rhythm echo.
7. **Poco F3 check** (`KEYPATH.md` §2) before Nora starts, then two to three
   weeks of use, read the engagement log, and decide what to deepen.
