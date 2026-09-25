# KeyPath releases

KeyPath is the piano tutor in `src/keypath/` (design: [`KEYPATH_TUTOR.md`](KEYPATH_TUTOR.md),
hardware: [`KEYPATH.md`](KEYPATH.md)). A release is a point on `main` worth naming; the
number shows at the foot of Settings (`src/keypath/app/release.ts`). The user's guide is a
shared doc, linked from the top of Home.

## Since release 1

- **Your own songs.** A piano MIDI with both hands in one track is offered a split
  between the hands, at a line it suggests and she can move. Notes past the 61 keys
  default to moving only those notes when they're few (under 5% of the song); "move
  only" isn't offered when it would change nothing (KEYPATH_TUTOR.md §9).
- **Every song says how hard, one hand or two, and how long** (Easy · Two hands · 0:32).
  An added song is rated by what it asks of the hands, held to the starter pack's
  own levels, and the level can be changed at import or later.
- **Songs from MuseScore as scores** (MusicXML, `.mxl`): the hands from the two staves, the
  printed finger numbers, repeats written out and bars numbered as on the page.
- **A long song's parts** are the same chips as any song's, on one scrolling line.
- **The coach's note**: after a song, a few words from Claude on what went well and what to
  practise, when the phone has an Anthropic key (Settings → Coach, with a test).
- **Settings regrouped** under headings, the player's options first.
- **MuseScore's own files** (`.mscz`, MuseScore 2 to 4) open the same way as MusicXML, with no
  subscription needed.

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
