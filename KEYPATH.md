# KeyPath — MIDI probe

A piano-learning app for Nora, eventually. **Today it is a hardware probe** that
answers one question:

> Can a phone reliably receive MIDI from a Yamaha PSR-E383 through a 0.5 m
> Delock USB-C (host) → USB-B cable, well enough to build a serious
> piano-learning app on?

**Two phones, tested in order.** The go/no-go test runs on Gabriel's
**Samsung Galaxy S24**. If it passes, full app development starts without
waiting for the second phone. Nora will practise on her own **Xiaomi Poco
F3**, which gets the same probe later as a compatibility check before she uses
the app. It has one known Xiaomi-specific catch (the OTG switch, §2). The
report records which phone it came from.

Nothing here teaches yet. No lessons, no songs, no scoring. If the answer is
yes, the next step is designing the lesson engine, not extending this page.

- Page: `/keypath-react.html` (unlisted: no registry entry, no Cabinet tile,
  `noindex`)
- Code: `src/keypath/`, strict TypeScript, built on `src/ds/`
- Tests: `npm test -- src/keypath`

---

## 1. Result: **go**

**Tested 24 September 2026 on the Galaxy S24** (SM-S921B, Android 16,
Chrome 153), launched from the home screen, with the Delock cable. Two reports,
about three minutes of connection, 131 notes in total. The S24 receives the
PSR-E383 reliably enough to build the app on, in the browser, with no native
code.

| # | Question | Measured |
|---|----------|----------|
| 1 | Working minimal prototype | **Done**, and live at `/keypath-react.html` |
| 2 | Connection steps | **Worked as written** (§2). Plug in, open, Connect MIDI, allow |
| 3 | Is the Yamaha detected? | **Yes, on both layers.** USB: "Yamaha Corporation Digital Keyboard", `0x0499:0x1710`. Web MIDI input: "Digital Keyboard" / "Yamaha Corporation", id `native:port-in-0`. Identified by name automatically |
| 4 | Note On / Off received? | **Yes.** 85 on / 85 off in the longer run. **Every** Note Off arrived as Note On velocity 0, as Yamaha's chart says. Lost, orphaned, reordered: **0 / 0 / 0** |
| 5 | Velocity received? | **Yes.** 1–101 seen (a grazed key read 1). Touch Response on Medium |
| 6 | Chords detected? | **Yes.** Three onsets within 12 ms (G4, A4, F4) arrived as three separate notes. A five-key cluster held together released cleanly. The first chord *test* failed because of a flaw in the test, not the transport (§3, "The first run"). Now fixed |
| 7 | Latency / limitations | Timestamp → page handler: **median 1.6 ms**, p95 24 ms, max 36 ms. Timestamp → next screen frame: **median 11 ms**, p95 24 ms. Timestamps of near-simultaneous keys stayed 1–12 ms apart even when the handler ran up to 34 ms late, so judging by timestamp is sound. Limitations: §5 |
| 8 | Browser/PWA viable? | **Yes.** Including launched from the home screen |
| 9 | Native preferable? | **No.** Nothing measured calls for it (§6) |
| 10 | Production architecture | §6 |
| 11 | Private content architecture | §7 |
| 12 | Copyright / security risks | §8 |
| 13 | What to build next | §9 |

Other things the run established:

- **Channel 1** for everything played on the keys. No other channel appeared.
- **Range: C2–C7, MIDI 36–96, confirmed.** The leftmost key reads C2 (36) and
  the rightmost C7 (96), with Transpose at 0.
- **Repeated notes:** four C4 presses, 455–794 ms apart, each Note On matched
  by its Note Off, in order.
- **Glissando:** 53 notes across 35 keys, fastest gap 38 ms, overlapping keys
  handled, nothing stuck.
- **Connection stable:** no drops in about three minutes. An unexplained
  single drop appeared once in an earlier page load and didn't recur.
- **MIDI Clock runs continuously, even with nothing playing.** Three runs,
  the last one about 2.7 minutes with only two notes played: a steady 31 F8
  bytes per second (≈ 78 BPM at 24 per beat), and no Start (FA) or Stop (FC)
  anywhere. Active Sensing arrives about every 300 ms. The probe ignores both.
  **Not yet checked:** whether the clock rate follows the keyboard's tempo
  setting. The probe's **Keyboard tempo (MIDI Clock)** readout in Live answers
  it directly (§3, "Tempo readout"). If it does, the app can read the tempo
  Nora sets on the instrument.
- **The phone's audio goes to the keyboard.** The test tone was heard from
  the Yamaha's speakers, so Android does route media to the PSR-E383's USB
  audio. Chrome reports **24 ms output latency** (+ 4 ms base). A metronome
  played through the keyboard should be scheduled that much early. KeyPath's
  own output stays at 0 until turned up (§2).
- **Sustain pedal: untested.** There isn't one. The PSR-E383 documents
  sending it as CC 64, and the probe and tracker already read it. Beginner
  lessons don't need it; test it the same way if a pedal (e.g. Yamaha FC4A
  or FC5, into the SUSTAIN jack) is added later.

Still to do on other hardware: the **Poco F3** compatibility check (§2, §3)
before Nora uses the app.

---

## 2. Connecting the PSR-E383 to the S24

### On the keyboard, before plugging in

These settings come from Yamaha's own manuals for the PSR-E383
([Reference Manual](https://data.yamaha.com/files/download/other_assets/3/2291233/PSR-E383_reference_manual_En_B0_web.pdf),
[Data List](https://data.yamaha.com/files/download/other_assets/1/2293841/PSR-E383_DL_EnFrEsDeZhRu_A0_web.pdf)).
Each one can make the probe look broken when it isn't.

| Setting | Where | Needs to be | What goes wrong otherwise |
|---|---|---|---|
| **Storage Mode** | Function 058 | **Off** | Yamaha's troubleshooting: "The application on your smart device doesn't recognize the instrument." The keyboard presents as a storage drive, not a MIDI device |
| **Touch Response** | Function 004 | Soft / Medium / Hard, **not Off** | With Off, every note is sent at one fixed velocity, which looks exactly like "velocity isn't transmitted" |
| **Local Control** | Function 041 | On | Off makes the keyboard silent; MIDI still flows |
| **Transpose** | Transpose button | 0 | Not yet known whether the keyboard transposes the notes it transmits. The probe will show it. Keep 0 for the tests |
| **Power** | Rear panel | AC adaptor | Yamaha's own list of low-battery symptoms includes playback cutting out; don't mix a power fault into a MIDI test |

Yamaha also recommends airplane mode on a phone used with the keyboard,
because radio interference can produce noise from the speakers. That's about
audio, not MIDI, but it's a cheap setting to change during the test.

### The cable

Yamaha's requirement for USB TO HOST is "an AB type USB cable of less than
3 meters. USB 3.0 cables cannot be used." The Delock is USB 2.0 and 0.5 m, so
it meets both.

"Host" is written into the cable: its USB-C end tells the phone to act as the
USB host, the way a computer does. A plain charge-only cable won't work at all,
and a cable wired the other way round would put the phone in device mode.

### Steps

0. **Poco F3 only:** Settings → Additional settings → **OTG** → on, *before*
   plugging in (§"Xiaomi's OTG switch" below).
1. Keyboard **off**. Plug the USB-B end into **USB TO HOST** on the rear panel
   of the PSR-E383.
2. Plug the USB-C end into the S24.
3. Turn the keyboard **on**.
4. Android may show a notification or dialog about the USB device. If it offers
   a choice of what to use the connection for, pick MIDI. With the phone as
   host this usually doesn't appear, but it depends on the build.
5. On the phone, open **Chrome** (not Firefox; §5) at the probe URL (§3).
6. Tap **Connect MIDI** and allow the MIDI permission prompt.
7. Optional: tap **Look on USB** and pick the Yamaha in Chrome's chooser. This is
   a second, independent check (§3).

### Xiaomi's OTG switch (Poco F3)

Xiaomi phones don't act as a USB host until **OTG** is switched on:
Settings → Additional settings → OTG. This comes from Xiaomi's support
article, as quoted in search results; the page itself refused a direct fetch,
so treat it as reported rather than confirmed. Two behaviours matter for
practice sessions:

- The switch is **off by default** and is **greyed out while any cable is
  plugged in**, charging cables included. Turn it on first, then connect.
- Xiaomi's support article says it **turns itself off after about 10 minutes
  without data transfer**. Whether the Yamaha's continuous Active Sensing
  counts as "data transfer" is unknown until tested. If it doesn't, the
  keyboard would vanish in the middle of a practice session.

Users on the xiaomi.eu forum also report OTG not working at all on some
HyperOS / Android 13 builds. The probe records the Android version, so the
report shows which build the Poco F3 is on.

The probe watches for this. **Connection → Drops** counts every time a
connected keyboard disappeared, and the report keeps a timestamped history.
A drop you didn't cause, especially around the 10-minute mark, is the OTG
switch.

Test for it on the Poco F3: connect, run the tests, then **leave the keyboard
idle for 15 minutes** with the page open, press a key, and check Drops.

### A practical issue: charging

Both phones have one USB-C port, and the cable takes it. For the length of a
practice session **the phone runs on battery and can't charge**. For the probe
that's fine. For daily practice it will matter, and the fix is hardware: a
USB-C hub with Power Delivery pass-through plus a standard USB-A-to-B cable.
Test that combination separately, because some hubs fall back to
charge-or-data.

### A second one: the phone's audio may move to the keyboard

The PSR-E383's USB TO HOST is **also a USB audio interface** (44.1 kHz,
16-bit stereo, per its spec sheet). Android usually routes media audio to a
USB audio device when one is attached, so the phone's sound (notifications,
music, and later the app's own metronome) may come out of the keyboard's
speakers instead.

**A web page can't choose the output on Android.** `HTMLMediaElement.setSinkId`
is marked unavailable on Chrome for Android (MDN: "Not available due to a
limitation in Android"), and without microphone permission Chrome hides the
list of audio devices. So the probe finds out the only reliable way: the
**Phone audio** panel plays a short tone and asks where you heard it. The
answer, the audio-device count and Chrome's output-latency estimate all go
into the report.

The fixes are settings, and the probe shows the right one for your answer:

| Where | Setting | Effect |
|---|---|---|
| **KeyPath itself** | **"KeyPath sound through the keyboard"** in the probe: toggle + volume slider, **default 0** | Everything KeyPath plays while the real keyboard is connected goes through this one gain stage, so the app never sends sound to the Yamaha until someone turns it up. Remembered per phone |
| **Keyboard (for the phone's other sounds)** | FUNCTION → **045 "[USB TO HOST] Audio Volume" → 0** | The keyboard ignores the phone's audio. MIDI is unaffected. The value survives power-off (the manual marks it as backed up). Reversible at any time |
| Phone | Settings → Developer options → **Disable USB audio routing** | Android stops routing audio to USB devices. Affects **every** USB audio device, USB-C earphones included |
| Keyboard | FUNCTION → **046 "Audio Loop Back" → Off** | Only matters if the app ever records: stops the phone's audio being sent back to it mixed with the piano |

**Why the app can't set Function 045 itself.** The PSR-E383's MIDI Data
Format (Data List, p. 33) documents exactly five system-exclusive messages it
accepts: GM System On, Master Volume, Master Tuning, Reverb type and Chorus
type. None of them reaches 045. Master Volume changes the keyboard's own
piano sound, which is the wrong knob. So no app, web or native, can switch it
over USB with documented messages. The in-app level above controls the other
end of the cable instead. That covers KeyPath's own sound, and 045 remains the
setting for everything else the phone plays.

It might be worth keeping. A metronome or backing track through the
instrument's speakers sounds better than through a phone, and it keeps Nora's
attention on the keyboard rather than the phone. Decide after hearing it.

---

## 3. Running the probe

### Getting the page onto the phone

Web MIDI only works in a **secure context**: HTTPS, or `localhost`. That rules
out the easy option of opening `http://<laptop-ip>:5173` over Wi-Fi. There are
three ways that do work:

| Option | How | Trade-off |
|---|---|---|
| **A. Production URL (in use)** | Open **https://coneofcold.vercel.app/keypath-react.html** | Real HTTPS, the same conditions the app will run under. Preview deploys are off for `claude/*` (`vercel.json`), so a change only reaches this URL once it's on `main` |
| B. USB debugging + port forward | `npm run dev`, then `adb reverse tcp:5173 tcp:5173`; open `http://localhost:5173/keypath-react.html` on the phone | No deploy, but the phone's one USB port is needed for the keyboard. Only works with wireless ADB |
| C. Chrome flag | `chrome://flags/#unsafely-treat-insecure-origin-as-secure` with the laptop's LAN URL | Quick, but leaves a security flag on the phone |

### The test sequence

1. **Connection panel.** Note each row:
   - *Secure context / Web MIDI API*: both should be green on Chrome.
   - *USB device*: tap **Look on USB**. If it's found, the Yamaha is physically
     on the bus.
   - *MIDI access*: after the prompt, **Granted**.
   - *MIDI input*: the port name the keyboard reports. Write it down; it's the
     one fact nobody can look up in advance.
   - *Yamaha PSR-E383*: identified by name, or "not identified". The name
     match is only a hint. Any input that sends notes gets used.
2. **Press keys freely.** They should light up on the on-screen keyboard; harder
   presses show as a brighter colour.
3. **Any key**, **Repeated note** (4× middle C), **Chord** (C4+E4+G4, marked
   on the on-screen keyboard; a held key that isn't a target shows red),
   **Glissando**. Each shows pass/fail with its measurements.
4. **Sustain pedal**, if there is one: the Sustain chip appears in Live.
5. **Phone audio**: tap **Play test tone** and answer where you heard it (§2).
6. Play normally for a few minutes. **Lost / orphan / reordered** should stay at
   `0 / 0 / 0`, and **On / Off** should match once your hands are off the keys.
7. Unplug and replug the cable with the page open. The input should disappear
   and come back without a reload (the hot-plug path).
8. **Share to Claude…** (Android's share sheet; pick Claude), or **Copy
   report** / **Download**. The report is plain JSON text. Where it lands
   depends on the Claude app, which may open a new conversation. If so, paste
   it into the KeyPath session instead, or just tell it to read the results.
9. **Poco F3, later:** the same sequence plus the 15-minute idle test from §2.

### The first run's chord test

On the S24 the chord test first reported "Missing: E4, G4; Unexpected: B3, A3,
G3, F3" with a 4.7-second "spread". It had scored everything played since the
test started: a lone C4, then a run of held notes. The transport handled every
one of those notes correctly. The test now judges **one attempt**, from the
first key down to the moment all keys are up again, and ignores single notes.
That's also the rule the lesson engine's "together" detection should use.

### Tempo readout (MIDI Clock)

The PSR-E383 sends MIDI Clock (24 ticks per beat) continuously. The Live
panel's **Keyboard tempo (MIDI Clock)** stat turns that into BPM, averaged
over the last two beats of ticks, and adds "Style playing / stopped" once a
Start or Stop arrives. It blanks ("no clock") a second after the ticks stop.
The report carries the last tempo, the tick jitter, and the Start/Stop counts
under `clock`.

To test it:

1. Connect as usual. Without touching anything, Live should show a tempo;
   ~78 BPM was measured before.
2. Press **[TEMPO/TAP]**. The keyboard shows "Tempo" and its current value.
   **Compare it with the readout.** They should agree to within about 1 BPM.
3. Type a new tempo on the SONG/STYLE category buttons, used as digits (e.g.
   1, 2, 0 for 120), then press **[SHIFT]** to leave the Tempo display.
   **Within about two seconds** the readout should move to the new value. Try
   a slow one (60) and a fast one (180) too.
4. Press **[START/STOP]**: the stat adds "Style playing" and the rhythm plays.
   Press it again: "Style stopped".
5. Tap **Share to Claude…**. The `clock` section records the result.

If step 3 changes the readout, the app can take Nora's tempo straight from
the instrument, with no tempo control on the phone. If the readout stays put
while the keyboard's tempo changes, the clock is a fixed internal rate and
the app will need its own tempo control.

### How to read the result

Integrity carries more weight than speed. Unplugged USB MIDI either works
completely or doesn't work; a probe that shows even one lost Note Off in normal
playing is a no-go, whatever its latency.

| Measure | What it means | Go |
|---|---|---|
| Lost / orphan / reordered | Dropped or mis-ordered messages | **0 / 0 / 0** after several minutes of play |
| Dispatch lag p50 / p95 | Chrome's timestamp → our JavaScript handler. How late the *page* hears about a key. **Not** key-to-sound: the Yamaha makes its own sound and never waits for the phone | Small and steady. What matters most is that the *timestamps* are correct, because judging rhythm uses them, not arrival time |
| To next frame p50 / p95 | Timestamp → the next screen refresh. Roughly when a key can appear lit | Around one to two frames at the S24's refresh rate |
| Chord onset spread | First to last key of the chord. Mostly your fingers | Tells the lesson engine how wide its "together" window must be |
| Velocity range | Lowest / highest seen | Spread wide when you vary how hard you play. A single fixed value means Touch Response is Off |

**What the probe can't measure is absolute key-to-event latency.** Nothing in a
browser can see the key move. If that number is ever needed, film the key and
the screen together with a second phone in slow motion and count frames. For a
learning app it probably isn't needed: the student hears the piano directly,
and timing is judged from event timestamps, which don't depend on how fast the
screen reacts.

---

## 4. What is already known about the PSR-E383

From Yamaha's MIDI Implementation Chart (Data List, p. 34, dated 02-May-2024)
and Reference Manual. These are the facts that shaped the code:

- **Note Off is sent as `9nH, v=0`**, a Note On with velocity 0. The keyboard
  never sends `8nH`. A parser that only understood `8nH` would see every key
  stay down forever. `midi/parse.ts` treats v=0 as Note Off, and the event
  monitor marks those rows with `*`.
- **Velocity: `9nH, v=1–127`** transmitted. No release velocity, no aftertouch.
- **Active Sensing is transmitted.** This is a keep-alive byte the keyboard
  sends continuously. It's counted and kept out of the event log, which it
  would otherwise flood.
- **Clock and Start/Stop are transmitted** while a Style (auto-accompaniment)
  plays. Same handling. Style playback also sends its own notes on other
  channels. The probe shows the channel for every event, and the lesson engine
  will need to listen only to the player's channel.
- **Sustain (CC 64) is transmitted.** Tracked separately from key duration.
  "How long did she hold the key" and "how long did it ring" are different
  questions for a teacher.
- **Pitch bend is not transmitted.**
- **Channel of the player's own keys:** the chart doesn't say directly. The
  probe records it. Main voice on channel 1 is the usual Yamaha arrangement,
  but that's an assumption until it's measured.
- **Octave naming:** Yamaha's documents call MIDI 60 "C3". KeyPath uses
  scientific pitch (60 = **C4**, middle C), which is what sheet music and
  teaching material use. The key is the same; the label differs by an octave.
- **Range:** 61 keys. The on-screen keyboard assumes MIDI 36–96 (C2–C7) and
  widens if a note arrives outside that. The report records the actual
  extremes.
- **USB vendor id** `0x0499` (Yamaha Corp., per the USB ID registry), **product
  id `0x1710`** (measured on the S24). The
  **Look on USB** chooser filters on it.

---

## 5. Android, browser and API limitations

Everything here applies to both phones. Both run Chrome on Android, and the
MIDI path through `android.media.midi` is the same. The differences are the
vendor layers on top: Xiaomi's OTG switch (§2) and each vendor's battery
management. That's one more reason to prefer a web app: one codebase covers
both vendors, and a vendor quirk gets fixed with a setting, not a separate
build.

- **Chrome for Android supports Web MIDI** (since Chrome 43, per MDN's
  compatibility data). Underneath, Chrome uses Android's own MIDI service,
  `android.media.midi`, available since Android 6.0. That service handles
  class-compliant USB MIDI devices, which Yamaha's keyboards are designed to
  be (no driver needed on macOS). So a working Web MIDI connection means the
  whole stack is working: the browser adds a layer on top rather than a
  separate implementation.
- **Samsung Internet** is Chromium-based and listed as supporting Web MIDI.
  Untested; Chrome is the reference browser.
- **Firefox for Android does not support Web MIDI** (MDN: not added). Desktop
  Firefox has it only behind a site-permission add-on. The probe says so
  plainly instead of failing silently.
- **Safari / iOS: no Web MIDI.** It doesn't matter for this hardware, but it
  would matter if Nora ever practised on an iPad. That would require a native
  app.
- **The permission prompt is universal now.** Since Chrome 124 (rolled out
  gradually), all Web MIDI access asks the user, not only SysEx. The probe
  asks for `sysex: false`, which gets the milder prompt.
- **Secure context required.** See §3.
- **Timestamps.** Each message carries a high-resolution timestamp on the
  `performance.now()` timeline. The probe records both that and the moment the
  handler ran. If the platform stamp were ever missing, it falls back to arrival
  time, and the report would show the two agreeing exactly, so the case is
  visible.
- **Background tabs.** Android throttles pages that aren't visible. KeyPath
  holds a screen wake lock for as long as it's open (keyboard or simulator),
  so the screen never sleeps mid-practice. Chrome releases it when the page
  is hidden; KeyPath takes it back when it's visible again. A practice app has to stay in the foreground anyway.
- **WebUSB can see the device but can't take it over.** Android's MIDI service
  already owns the keyboard's MIDI interface. **Look on USB** only lists the
  device; it never opens it. That's what makes it a clean second check:
  - seen on USB **but not** as MIDI → Android's MIDI layer, or the keyboard's
    Storage Mode;
  - **not even on USB** → cable, host mode, or power.

---

## 6. Recommended architecture: browser/PWA, native, or hybrid

### The recommendation: **A. browser/PWA**, with the MIDI layer kept swappable

This depends on the probe passing. The case for it is specific to this setup:

1. **The keyboard makes the sound.** The latency that most often rules out
   browser music apps is audio output latency (phone → speaker). It doesn't
   apply here: Nora hears the Yamaha directly, with zero phone latency. The app
   only has to *hear* the keys, *judge* them and *draw* them. Judging uses
   event timestamps, so even a late screen frame doesn't make a correct note
   look late.
2. **The native path underneath is the same.** Chrome uses `android.media.midi`.
   A native app would use the same service and gain lower-level access to it,
   not a different or better USB driver.
3. **Everything else favours the web.** It's the stack this repo is built on,
   deploys are one push, updates need no store, and a laptop with a USB
   keyboard can run the same app.

### When to switch to C. hybrid (not B)

If the probe finds a *browser*-specific problem (missing or bad timestamps,
dropped events under load, a permission flow that keeps breaking), the answer
is **hybrid**: the same React app in a thin Android shell (Capacitor), with a
small native plugin that wraps `android.media.midi` and implements the same
`MidiConnection` interface. The lesson engine and UI don't change; only the
event source does. That swap is why the MIDI layer exists as a separate module.

A **Trusted Web Activity** (a PWA packaged for the Play Store) would *not*
help. It runs the same Chrome with the same Web MIDI.

**B. fully native** only makes sense if the app needs to *produce*
low-latency audio itself, e.g. its own piano sound when the keyboard isn't
there. Nothing in the brief asks for that.

### The MIDI layer (what the probe already establishes)

```
src/keypath/
  midi/                     ← no React, no UI. The lesson engine imports only this.
    types.ts                  MidiEvent = NoteOn | NoteOff | ControlChange | …
                              MidiDevice, MidiConnection (the swappable interface)
    parse.ts                  bytes → MidiEvent (v=0 Note On → NoteOff)
    webMidiConnection.ts      MidiConnection over Web MIDI (hot-plug, permissions)
    simulatedConnection.ts    MidiConnection from on-screen taps (no cable needed)
    noteTracker.ts            pure reducer: held notes, durations, integrity counters
    clockTracker.ts           pure reducer: MIDI Clock → the keyboard's tempo; Style start/stop
    noteNames.ts, identify.ts, timing.ts, emitter.ts
  probe/                    ← the probe's own logic, also UI-free
    probeSession.ts           owns a MidiConnection; external store for React
    diagnostics.ts            pure verdicts for the four tests
    environment.ts, usb.ts, report.ts
  components/               ← React: reads ProbeSession, draws it
  content-boundary.test.js  ← fails the suite if music files are tracked
```

A future `NativeMidiConnection` (Capacitor plugin) would be a third
implementation of `MidiConnection`. `ProbeSession` is the pattern for the
lesson engine: a plain class that consumes events and exposes a snapshot, with
React only as a viewer.

### Why the simulator makes a sound and the keyboard doesn't

In simulator mode a small Web Audio synth (`probe/synth.ts`) plays each tapped
note, with a **Sound on/off** toggle. With the real keyboard the page stays
silent on purpose: the Yamaha sounds its notes instantly, and a second copy
from the phone would arrive audibly late. The lag you can hear between tapping
the screen and the simulator's sound is the phone's audio path, which is the
same reason the production app should let the instrument make the sound.

### What the probe is not

It has no service worker, no manifest and no Cabinet entry, on purpose. A
cached probe answering from yesterday's build is the last thing a hardware test
needs, and CABINET.md reserves the registry for apps that are stable. The real
app gets all three when it exists.

---

## 7. Content architecture: keeping private music private

### The rule

**The application is public code. The music is not.** The repository and the
deployed bundle contain the lesson *engine* and never lesson *content*, except
material that has been verified as public domain.

### The three content classes

| Class | Examples | Where it lives | Distributable? |
|---|---|---|---|
| **1. Public domain** | A Bach minuet from an edition whose status is verified | May ship with the app, in a `public-domain/` content pack, **with a provenance note per work** | Yes, after verification |
| **2. Privately owned / licensed** | A purchased arrangement of a modern song, a Flowkey-style import | Private storage only | **No** |
| **3. User-generated** | A MIDI you record, a lesson you build | Private storage by default | Only by explicit choice |

"Public domain" is decided per *edition*, not per composer. Bach is public
domain, but a 2019 engraving, fingering or arrangement of Bach may not be. A
class-1 entry needs the work, the edition or source, and why its status is
certain. The same provenance note is required by the `ALLOWED` list in
`content-boundary.test.js`, the only way a music file can enter this repo.

### What's enforced today

- `.gitignore` blocks `*.mid`, `*.midi`, `*.kar`, `*.rmi`, `*.musicxml`,
  `*.mxl`, `*.mscz`, `*.mscx`, `*.sib`, plus root folders `keypath-content/` and
  `private-content/` for keeping a working library next to the checkout.
- `src/keypath/content-boundary.test.js` runs in `npm test` and fails if **any**
  tracked file in the repo has a music extension (a wider list than
  `.gitignore`, including `.ly`, `.abc`, `.gp*`, `.mei`), or if a PDF sits under
  `src/keypath/` or `public/keypath*`. That catches `git add -f`, a renamed file
  and a new format. `public/` matters most: Vite copies it verbatim into the
  deployed site.
- The probe itself contains no content and fetches none.

### Recommended production model: a private host

```
Private object storage  ──  one per-user prefix: users/<id>/{songs,lessons,midi,musicxml,sheet-music,user-content}
        ↑ (server-side only; the app never holds a storage key)
Content API (small, authenticated)
        ↑ HTTPS, per-request auth
KeyPath app (public PWA)  →  Chrome on the S24  →  USB MIDI  →  PSR-E383
```

The app asks the API for "my library". The API checks who is asking, lists
only that user's objects, and returns short-lived signed URLs (minutes, not
days) for the specific files requested. The app fetches, parses and discards.

### Hosting options

**Constraint first: this repo is at Vercel Hobby's 12-function limit**
(`ls api/*.js | grep -v '^api/_'` → 12). A KeyPath content endpoint **can't
be added here** without breaking every deploy (CLAUDE.md, "Deploy guardrail").
That pushes towards one of these:

| Option | How | For | Against |
|---|---|---|---|
| **1. Supabase (recommended)** | Supabase Auth (magic link / Google) + Storage in a **private bucket** with row-level security (`users/<uid>/…`); the client gets signed URLs directly | No serverless function needed, so the function budget is untouched. Per-user isolation is enforced by the database, not by our code. Free tier is ample for one family's library | A new service and account |
| 2. KeyPath as its own Vercel project + Vercel **Private Blob** | Split KeyPath into its own repo/project with its own function budget; one `api/content.js` issues signed Blob URLs after checking auth | Stays on Vercel; Private Blob is GA (Vercel changelog, 30 Jun 2026); signed URLs are scoped to one pathname and operation, up to 7 days, and should be issued for minutes | Auth still has to be built (e.g. Auth.js or a passkey); two projects to run |
| 3. Home NAS behind Tailscale | Files on a home server, reachable only on the family tailnet | Content never leaves the house | The phone needs Tailscale running; nothing works away from the tailnet unless it's set up for that |

Option 1 fits a private family app best. Option 2 is right if everything
should stay on one vendor.

**Supabase's free plan, as of September 2026** ([pricing page](https://supabase.com/pricing)):
50,000 monthly active users, 500 MB database, 1 GB file storage, 5 GB egress,
two active projects. **Free projects pause after 1 week of inactivity.** Data
is kept, but the app can't reach it until the project is resumed from the
dashboard. A week-long holiday without practice would trigger it. The Pro plan
(from $25/month) removes the pause. A 1 GB storage limit is ample: MIDI and
MusicXML files are kilobytes; only scanned PDF scores are large.

### Accounts and profiles (Gabriel and Nora)

Supabase Auth handles any number of accounts, so separate libraries and
progress for Gabriel and Nora are straightforward. The question is how to cut
it:

| Model | How it works | For | Against |
|---|---|---|---|
| **A. One family account, several profiles (recommended)** | Gabriel signs the family account in on **both** phones, once each. Each phone is **pinned to its profile**: Nora's Poco F3 opens straight into Nora, the S24 into Gabriel. Switching needs a PIN. Songs belong to the family library; **progress, settings and chosen learning path belong to a profile** | Nora never types a password. No child account holding her personal data. The library (songs you bought) is owned once and shared. You can see her progress from your phone | Profiles aren't a security boundary against each other. The family session on her phone could reach your profile if the PIN is guessed. A PIN is a lock on the door, not a wall. Enough for a family |
| B. Separate accounts | Nora and Gabriel each sign in with their own email | Hard separation. Nora could later use her own device | Two logins on one phone. A child account holding personal data. Shared songs need an explicit sharing model |
| C. A then B | Start with A. Promote a profile to its own account if Nora ever needs one | No decision needed now | Promotion needs a small migration, which is easy if planned for |

Recommended: **A, designed so C is possible.** Nora having her own phone
makes A work better, not worse: the profile picker becomes a one-time setting
per phone instead of a choice at every launch. B only earns its extra cost if
she'll ever use KeyPath without you managing the account, and C covers that
day. The data model:

```
accounts   (id = auth.users.id)                       ← the login, held by Gabriel
profiles   (id, account_id, name, avatar, pin_hash?)   ← Nora, Gabriel
devices    (id, account_id, profile_id, label)         ← "Nora's Poco F3" → Nora
songs      (id, account_id, class, storage_path, …)    ← family library; class 1/2/3 from above
visibility (song_id, profile_id)                       ← optional: hide a song from a profile
progress   (profile_id, song_id, attempts, best, …)    ← per person
```

Row-level security: every row is readable only when its `account_id`, or its
profile's `account_id`, matches `auth.uid()`. Storage paths are prefixed with
the account id and gated by the same rule. Profile-level visibility (for
example, Gabriel's own pieces not showing up in Nora's picker) is an app rule
on top of that, not a security rule, per the "Against" column above.

---

## 8. Security and copyright risks

| Area | Risk | Mitigation |
|---|---|---|
| **Static assets** | Anything in `public/` or imported by the app is **world-readable** on the deployed site and in GitHub | Never there. `content-boundary.test.js` + `.gitignore` |
| **Public URLs** | "Unguessable" URLs leak through history, screenshots and share sheets, and they don't expire | No permanent content URLs; only short-lived signed URLs for one object |
| **Signed URLs** | A signed URL works for *anyone* who has it until it expires | Minutes-long expiry, one object per URL, issued only after auth; never log or store them |
| **Browser caching** | HTTP cache and CDN can keep private files, and a shared CDN could serve one user's file to another | API responses `Cache-Control: private, no-store`; signed-URL fetches `no-store`; the content host must not sit behind a shared cache keyed only by path |
| **Service worker** | A future offline mode would put private files into Cache Storage | Offline copies go into a separate, per-user IndexedDB store, cleared on sign-out. Never precache content in the SW manifest |
| **Downloaded files** | A downloaded MIDI is outside our control from then on | Don't offer "download" for class-2 content. Rendering in-app is the product |
| **API endpoints** | IDOR: `?song=123` returns someone else's song if only the id is checked | Authorise every request against the owner (RLS in Supabase does this at the database) |
| **Authentication** | Tokens in `localStorage` are readable by any script on the origin, and this repo hosts many apps on **one origin** | Put KeyPath's production app on **its own origin** (own project or subdomain). This is the strongest single argument for splitting it out |
| **Private object storage** | A bucket accidentally made public is the classic leak | Private bucket, per-user prefix, no list permission for clients |
| **Local caching on the phone** | A lost or shared phone exposes the library | Acceptable for a family app, but sign-out must clear local content |
| **Secrets** | A storage key in client code is a full leak | Keys live only server-side (or not at all, with Supabase RLS) |
| **Copyright** | Distributing a class-2 file, even to one other person, is distribution | Private per user; no sharing feature for class 2. Nothing in KeyPath circumvents DRM or scrapes protected sources, and nothing will: content comes in as files the owner already holds |
| **Nora's data** | Practice history of a child | Stays in the private store; nothing goes to analytics. Vercel Insights isn't included on the probe page |

---

## 9. What to build next

The probe passed on the S24 (§1), so this list is now the plan.

1. ~~**Record the result**~~ Done, §1.
2. **Design for a dropped keyboard from day one.** The lesson engine should
   pause when the input disappears and resume when it comes back. Hot-plug
   already works in the MIDI layer. This costs little now, and it covers
   whatever the Poco F3's OTG switch turns out to do, a knocked cable, or a
   keyboard switched off mid-lesson.
3. **Poco F3 compatibility check** (§2, §3) before Nora uses the app. Not a
   gate for starting development.
4. **Try the charging hub** (§2) with the probe, before any daily-use design
   assumes it.
5. **Lesson engine core, UI-free**: a `PerformanceJudge` consuming
   `MidiEvent`s against an expected note sequence (pitch, onset window, chord
   window sized from the measured spread, duration). Pure, tested like
   `diagnostics.ts`.
6. **Song model + one importer**: an internal `Song` type and a MIDI-file
   importer (later MusicXML), fed from a **local file picker** first, so no
   hosting is needed to start.
7. **Public-domain starter pack** (3–5 pieces, provenance noted) as the first
   real content.
8. **Content host** (§7, option 1), then signed-URL loading.
9. **Nora-facing design**: learning paths she chooses and adapts, drawing on
   the best of Flowkey (wait-for-correct-note mode, hand separation) and Simply
   Piano (short wins, progression). That's a design conversation with her, not
   a technical step, and it deserves its own document.
10. **Split KeyPath into its own origin/project** at the point it gets auth
   (§8, "Authentication").
