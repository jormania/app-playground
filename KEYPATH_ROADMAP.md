# KeyPath — roadmap

Ranked by perceived value: how much each item helps Nora learn and keep at it,
and how much it smooths the family's daily use, weighed against the effort.
Written 2026-09-29, after release 2, the easy version and fourteen starter songs.
Updated the same day: release 3 built everything marked ✅ below. What remains is the MIDI-out
test (item 5, a session at the keyboard) and the items that need something a session of code
can't give: Nora's playing to tune against (14, 21), her answers (20), a reliable melody
source (16) or a heavy dependency worth deciding on first (19, 23).

The ranking is a judgement, not a measurement. Two things should re-rank it:
- **Nora's answers** to the open questions in `KEYPATH_TUTOR.md` §8 (what she
  liked in Simply Piano and Flowkey, the one song she'd love to play, songs vs
  games vs story vs making music).
- **The engagement log.** After two or three weeks of real use, Progress shows
  which doors she opens, where songs are abandoned and which settings she
  changes. An item nobody would reach goes down; one fixing a common stop goes up.

`KEYPATH_TUTOR.md` §10 keeps the detailed notes on items deferred during the
build. This file is the order to take them in, with new ideas added. When an item
is done, strike it here and describe it in `KEYPATH_TUTOR.md` §9, as before.

Effort: **S** is a day or less, **M** a few days, **L** a week or more.

## Now: the next release

Small things that remove daily friction, or unblock several later items.

| # | Item | Why it matters | Effort |
| --- | --- | --- | --- |
| 1 | ✅ *Done, release 3.* **Remember each song's setup.** Hands, speed and part are kept per song and per player (the other-hand choice already is, phone-wide). | Today every visit starts at right hand, 100%, the first unlearnt part. A child who practises the left hand at 75% resets it every day, or doesn't, and plays the wrong thing. | S |
| 2 | ✅ *Done, release 3.* **Where your hands go.** Before a part starts, a small picture shows where each thumb sits ("right thumb on C, left little finger on the C below"). Built-in songs take it from their fingering; imported ones from the part's lowest notes. | Starting in the wrong place is the commonest beginner stumble, and imported songs have no finger numbers to show it. | S–M |
| 3 | ✅ *Done, release 3.* **An easy version starts slower.** A song whose easy version is still rated Harder for speed opens at 75% (Believer, Interstellar), and remembers what she picks after that (item 1). | The easy version thins the notes but can't slow a fast tune; the first try shouldn't be the hardest one. | S |
| 4 | ✅ *Done, release 3.* **Bigger names on the falling notes**, bold and sized to the note like the names on the keys. | The note names were hard to read on the keys; the falling notes carry the same small letters. | S |
| 5 | **Run the MIDI-out test** on the PSR-E383 (`KEYPATH.md` §3, "Phone → keyboard"). It's a session at the keyboard, not code. | It unblocks three things: the other hand and Listen in the Yamaha's own piano sound, the Studio starting a Style in time, and a drum sound for Rhythm echo. | S |
| 6 | ✅ *Done, release 3.* **Hear your try.** Every song attempt is recorded quietly; the report gets **▶ Hear your try** beside **Listen**, to compare with the song. | Hearing yourself is one of the fastest ways to improve, and the Studio already records; songs don't. | M |

## Next: the release after

Bigger steps in the learning itself.

| # | Item | Why it matters | Effort |
| --- | --- | --- | --- |
| 7 | ✅ *Done, release 3.* **A daily reminder**, at a time the family picks, through `src/shared/notify` (already used by Touch Grass, Sol Odyssey and the Journal). | Little and often is the whole method, and a nudge is what keeps a ten-year-old's habit going. Android may delay a background reminder; the notify module and `NOTIFICATIONS.md` cover what works. | M |
| 8 | ✅ *Done, release 3.* **Loop any bars from the play screen**, not only the one the report names: long-press a part chip, or pick two bars. | Practising the hard bar works (the speed ladder), but today she has to finish the song first to reach it. | S |
| 9 | ✅ *Done, release 3.* **The music, written.** A strip above the falling notes showing this bar and the next on the staff, switchable. It grows from the Journey's small staff. | The bridge from falling notes to reading music. Without it she can play songs but not read them, and the Journey's reading steps stop at one bar. | L |
| 10 | ✅ *Done, release 3.* **Suggested fingers for imported songs.** Simple rules: one five-finger position per phrase, a shift where the tune leaves it. Shown paler than written fingering and labelled *suggested*. | Imported songs have no finger numbers, and right fingers are what make a tune flow. The risk is a wrong number, which is why they're marked and can be turned off. | M–L |
| 11 | ✅ *Done, release 3.* **Play together.** Two players on one keyboard: one takes the right hand, the other the left, each scored in their own name. | Gabriel and Nora at the piano together; the most motivating practice there is, and the app already knows both hands and both players. | M |
| 12 | ✅ *Done, release 3.* **A warm-up in Today.** Sixty seconds of a five-finger pattern or a scale, with the hand position shown (item 2). | Technique isn't practised anywhere yet; Hoffman and every teacher start a lesson this way. | M |
| 13 | ✅ *Done, release 3.* **Change a song's key by hand**, ± semitones, in the ⋯ menu. The easy version already picks a whiter key; this lets a family choose, say, to match a recording. | Small and rarely needed, but it's the one thing the easy version can't be told. | S |
| 14 | **Judge how long notes are held**, in Show it and Keep going. | Rhythm is half of music and only note starts are judged today. Needs Nora's playing to tune. | M |

## Later

| # | Item | Why it matters | Effort |
| --- | --- | --- | --- |
| 15 | ✅ *Done, release 3.* **Search and filter the song list** (level, one or two hands, easy version, added by us). | Fine at fourteen songs plus a few added; needed once the list passes twenty or so. | S |
| 16 | **Romanian songs in the starter pack**: "Melc, melc, codobelc", "Căţeluş cu părul creţ". | Songs she knows are the ones she'll want to play. Blocked on a reliable source for each melody: a wrong tune is worse than none. | S each |
| 17 | ✅ *Done, release 3.* **D.C., D.S. and Coda** in scores. | Some downloaded pieces use them; today their jumps are played straight through. | M |
| 18 | ✅ *Done, release 3.* **Intervals by ear**, a fourth game. | Ear training, if the log shows Challenges is her door. | M |
| 19 | **Make a song from a recording** (Spotify's Basic Pitch; detail in `KEYPATH_TUTOR.md` §10). | "Play the song I hummed" is magical, but the cleanup screen is most of the work. Comes back if she uses Add a song. | L |
| 20 | **A look of her own**: art direction, collectibles or unlockable Styles, from her answers (her email hints at *Wolfwalkers*). | Could matter a lot for motivation, but only her answers can say which way. | M–L |
| 21 | **Rhythm echo latency**: compensate for the phone's audio delay once measured on her phone. | Her taps read a little late when the rhythm plays on the phone. | S |
| 22 | ✅ *Done, release 3.* **A PIN on a player.** | Only needed if a sibling starts playing on the same phone. | S |
| 23 | **Loud and soft** (dynamics). | Musical, but far off for a beginner. | M |

## Reading (release 4), from clefPlayer

Taken on 2026-10-03 from [clefPlayer](https://apps.apple.com/ch/app/clefplayer-learn-piano/id6793831932),
a piano practice app its author built for themselves and described on r/pianolearning. Most of
what it offers KeyPath already had; what it does better is reading the music rather than
following lights, which is where KeyPath was weakest.

| # | Item | Why it matters | Effort |
| --- | --- | --- | --- |
| 24 | ✅ *Done, release 4.* **The written view.** On a song's setup, *Notes: Falling / Written*: the staff alone, large, no falling notes; it waits for each note; a wrong key is written in red; the keys light only when she is stuck. | Falling notes can be played without reading a note: this is the way to read a song she plays. | M |
| 25 | ✅ *Done, release 4.* **Read and play**, a fifth game: short tunes made up on the spot, read from the staff with the keys dark, three levels from the Journey's notes. | Sight-reading needs music she hasn't memorised; a generator gives endless new tunes. | M |
| 26 | **Loop a stretch of bars**, not only one: a from–to in the bar picker, on the speed ladder. | Stumbles are at bar lines and hand shifts; worth it once she plays longer songs of her own. | S |
| 27 | **Keys lit only when stuck, for falling notes too.** | Little on its own: a falling note already shows its key. Built into the written view, where it matters. | S |
| 28 | **Pickups in the starter songs.** Happy Birthday, Für Elise, When the Saints and Brahms' Lullaby count bars from their first note, so their bar lines sit a beat or two off the printed music. Needs a pickup in the starter format, and phrase starts in beats (a phrase there begins with its own pickup). | The written view shows bar lines where no score has them; a reader learns the bar from them. | M |

Left out: hiding the screen's keyboard (on a phone it is the touch fallback and shows the hands'
places), engraved sheet music (months of work, a heavy library, and MIDI files carry no notation
to engrave), and horizontal scrolling (the written view does that job).

## Left out on purpose

A pianist on video, a big pop library (copyright; **Add a song** is the way in
for those), streaks that can break, and anything that sends her name or her
playing anywhere except the Claude notes she can turn off. The sustain pedal waits
until a footswitch is bought.
