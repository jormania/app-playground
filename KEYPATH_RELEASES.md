# KeyPath releases

KeyPath is the piano tutor in `src/keypath/` (design: [`KEYPATH_TUTOR.md`](KEYPATH_TUTOR.md),
hardware: [`KEYPATH.md`](KEYPATH.md)). A release is a point on `main` worth naming; the
number shows at the foot of Settings (`src/keypath/app/release.ts`). The user's guide is a
shared doc, linked from the top of Home.

## Release 5 — 2026-10-04

The play screen, drawn properly, and the songs barred as printed. Details in `KEYPATH_TUTOR.md` §9, "Release 5".

- **An engraved score** (VexFlow): real clefs, beams, ties and rests, both hands on a grand
  staff, bar numbers matching "Practise bar", the bar being played tinted and the notes to play
  glowing. In the written view and in the music strip, which now shows on a phone on its side
  too, with a line moving in time with the falling notes.
- **A new keyboard**: a fallboard, keys with depth, and three distinct states: the key to play,
  a key just played right, a wrong key. Middle C is named while it's asked for.
- **Bigger falling notes** on a phone held upright, each with its name as well as its finger.
- **A first look** at the Journey and each game: three lines, "Don't show this again", and
  "How it works" to see it later.
- **Pickups** (roadmap 28): Happy Birthday, Für Elise, When the Saints and Brahms' Lullaby are
  barred as printed, each part starts with its own pickup, and two rhythm slips in our
  arrangements are fixed.
- **Bigger, bolder names and finger numbers**, on the notes and on the keys; black-key notes
  drawn over their neighbours; Do-Re-Mi and "both" names that fit.
- **After an audit the same day**: lines of music broken by width and justified, a page full
  of music upright, no key left lit after a part, and a count-in Für Elise can follow.

## Release 4 — 2026-10-03

Reading. Details in `KEYPATH_TUTOR.md` §9, "Release 4".

- **The written view.** On a song's setup, *Notes: Written* shows the music on the staff alone,
  large, with no falling notes. It waits for each note, writes a wrong key in red, and lights a
  key only when she is stuck.
- **Read and play**, a fifth game: short tunes made up on the spot, read from the staff with the
  keys dark. Three levels, from five fingers in the right hand to both hands.
- **After an audit the same day**: the staff follows Listen again and marks only the note to
  play; a chord stays lit once she's stuck; naturals after a sharp; Read and play shows a short
  tune whole, has a Stop, and asks for middle C again after the keyboard is reconnected.

## Release 3 — 2026-09-29

The roadmap's first two tiers, and most of the third. Details in `KEYPATH_TUTOR.md` §9,
"Release 3".

**On the play screen**
- **Each song remembers its setup**: hands and speed, per player.
- **Where your hands go**: badges on the keys and a line in words before a part starts.
- **Finger numbers fade** once a song is learnt (Settings can keep them).
- **Suggested fingers** on songs that come without them, paler and marked as suggested.
- **The music, written**: this bar and the next on a staff above the falling notes.
- **Hear your try**, **practise one bar** from the setup, and **change a song's key**.
- Bigger, bold note names on the falling notes.

**Habit**
- **A daily reminder** at a time the family picks, and **a warm-up** as a fourth thing in Today.

**Together**
- **Play together**: two players, one keyboard, one hand each, scored in their own names.
- **A PIN** on a player, if wanted.

**Library and games**
- **Search and filter** the song list; **Ear check**, a fourth game: find the second of two notes by ear.
- **D.C., D.S., Coda and Fine** followed in downloaded scores.
- Four more starter songs, and MuseScore 4.1 files (Interstellar) now open.

**Fixed after an audit the same day**: D.C./D.S. in real MuseScore files, **Whole song** after
a practised bar, a try playing on over the next take, Ear check asking for the lit note, the
warm-up counting as a song, older added songs without suggested fingers, and a reminder that
could come near midnight (it now stays quiet from 22:00).

**Still to come**: the MIDI-out test at the keyboard, judging how long notes are held, and
what needs Nora's answers. See `KEYPATH_ROADMAP.md`.

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
