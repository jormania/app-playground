# KeyPath releases

KeyPath is the piano tutor in `src/keypath/` (design: [`KEYPATH_TUTOR.md`](KEYPATH_TUTOR.md),
hardware: [`KEYPATH.md`](KEYPATH.md)). A release is a point on `main` worth naming; the
number shows at the foot of Settings (`src/keypath/app/release.ts`). The user's guide is a
shared doc, linked from the top of Home.

## Release 2 — 2026-09-25

Songs from MuseScore, and Claude in KeyPath. Everything built after release 1 through the
release-2 commit on `main`.

**Your own songs**
- **MuseScore files.** `.mscz` from MuseScore 2 to 4, with no subscription needed, and
  MusicXML (`.mxl`, `.musicxml`). The hands come from the two staves, with the printed finger
  numbers, repeats and first/second endings written out, and bars numbered as on the page.
- **Both hands in one track.** A piano MIDI with both hands in one track is offered a split,
  at a line KeyPath suggests and she can move.
- **Notes past the 61 keys.** When they're few (under 5% of the song), the default is to move
  only those notes. "Move only" isn't offered when it would change nothing.
- **Every song shows its level, hands and length** (Easy · Two hands · 0:32). An added song is
  rated by what it asks of the hands, held to the starter pack's own levels. The level can be
  changed at import or later.

**Claude** (with an Anthropic key on the phone: Settings → Claude, with a test)
- **The coach's note.** After a song, a few words on what went well and what to practise next.
- **The weekly note.** In Progress, a short paragraph for the parent about the last seven
  days, written when asked.
- **Call and answer.** In the Studio, Claude answers her take with a phrase of its own. She can
  play the answer and learn it in Songs.

**Around the app**
- **A long song's parts** are the same chips as any song's, on one scrolling line.
- **Settings regrouped** under headings, the player's options first. "Face" is now "avatar".

## Release 1 — 2026-09-25

The first whole version: a piano tutor for the Yamaha PSR-E383 over USB, on the phone,
in English and Romanian, landscape first. Everything built through PR #110.

- **Home.** Today (a song, a Journey step and a game, about five minutes, no streak),
  the four doors, a shelf of twenty-three stickers, and the user's guide.
- **Journey.** Ten steps from middle C to reading higher, finger numbers second. Learn it
  with the keys lit, Check with them dark, or test out of a step.
- **Songs.** Ten starter songs, easiest first (Easy, Medium, Harder), with finger numbers.
  Learning in parts; Wait for it, Show it, Keep going; Listen first; speed; practising one
  bar on a speed ladder; the other hand plays itself; Try next.
- **Your own songs** from MIDI files: which part is which hand, and a choice for notes past
  the 61 keys, changeable later; rename and remove.
- **Challenges.** Note race (by name or on the staff), Rhythm echo (ta and ti), Chord catch;
  three levels each, bests kept.
- **Studio.** Recording over the keyboard's Styles, count-in and metronome, takes kept,
  named, favourited and saved as MIDI files; Make it yours from a song.
- **Settings, Progress and backups.** Several players on one phone, each with their own
  settings and progress; a backup file for a reset phone.
