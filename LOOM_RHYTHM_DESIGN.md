# The Rhythm — Daily Routines for Loom

> *A rhythm is a pattern the loom already knows — threads it places on the warp
> before you even sit down.*

---

## The Problem

You have a set of daily routines — morning pages, exercise, deep work, journaling — that belong on **every day** of the week. Today, getting them there is tedious:

- **Drafts (Templates)** save a week snapshot and cast it back, but they stamp each item onto **the weekday it was saved from**, not all seven. You'd need to manually create a thread on every day, save that as a draft, then cast it — and even then the draft duplicates them every time you cast, even if they're already there from last week's carry-over.
- **Creating from scratch** every Monday is exactly what a planner should eliminate.
- **HabitNow and its kin** solve this, but with a field-heavy, category-heavy setup that puts you in admin mode instead of flow.

What you want: **one curated list of daily threads that silently appears on every day of a fresh week, visually distinct from the one-off work you pile on top — and never duplicated when you don't want it.**

---

## Design Principle: No New Object Kind

Loom has exactly **one data type: the thread.** That's the engine of its simplicity. This feature must not introduce a second ("habit") type. No new Notion properties. No toggle asking "is this a task or a habit?"

Instead, the solution should feel like what it is: **a special skein (project) whose behaviour is slightly different from the rest.**

---

## The Concept: "Rhythm" — A Special-Flavour Skein

A **Rhythm** is a skein you mark with a single flag: *"this is a rhythm."* That's the entire categorization burden — you choose it once when you create or promote the skein, not per-thread.

### What makes a rhythm skein special

| Aspect | Ordinary Skein | Rhythm Skein |
|--------|---------------|--------------|
| Contains | Threads in any quantity, assigned to any day or the distaff | An ordered list of threads — the *canonical list* of your daily repeaters |
| Casting behaviour | n/a | Every Monday (or when you open a new week), Loom looks at the rhythm skein and **places one copy of each thread on every day** of the week — seven copies per entry, in the order you set in the skein |
| Visual treatment in Week view | Mixed in with everything else | A subtle visual separator — rhythm threads sit **at the top** of each day column, grouped together, with a quiet accent border or background tint so you always know "these are the givens; everything below is the day's live work" |
| Duplication guard | — | Before casting, Loom checks what's already on each day (from carry-over, a previous cast, or manual creation). If a thread with the same title + same rhythm skein already exists on that day, it's **skipped**, not duplicated |
| Completion | Each day's copy is an independent thread — weaving Monday's "Meditate" doesn't weave Tuesday's | Same |
| Deletion / editing | — | Deleting a day's copy only deletes that copy. Editing the canonical list (the rhythm skein) changes what gets placed next week — it never retroactively touches threads already cast |

### How Many Rhythms?

Start with **one**. Most people have one daily routine. But the mechanism is general — nothing stops a second rhythm skein later (e.g. a "Weekday-only" rhythm that only casts Mon–Fri, or a "Weekend" rhythm). The architecture accommodates this naturally because the flag lives on the skein, not the app.

For V1: one rhythm. The UI says "your rhythm" (singular). Expansion is a future dial, not a V1 checkbox.

---

## The User's Week, Step by Step

### Setup (once)

1. In the **Skeins view**, create a new skein — call it anything: "Morning", "Daily", "The Ritual."
2. Add threads to it in the order you want them: *Meditate · Morning pages · Workout · Deep work block · Journal.*
3. Open a **small menu** on the skein header (or a toggle in the skein's inline options) → **"Set as your rhythm."** One tap. Done.

> The rhythm skein now shows a subtle icon (🎵 or a small wave glyph) next to its name wherever it appears — Skeins view, thread chips, etc. — so you always know which skein is the rhythm.

### Monday Morning

You open Loom. The week is fresh.

- A **gentle banner** appears in the Week view (same placement as the draft-repeat offer): *"Your rhythm has 5 threads. Weave them onto this week?"* Two buttons: **Weave** and **Not this week**.
- Tap **Weave**: Loom creates threads on Mon through Sun, in order, at the top of each day. The banner disappears. The cast is logged so it won't nag again this week.
- Tap **Not this week**: Banner dismissed, logged, gone.

If you navigated away and come back later, the banner reappears until you act on it — same as the draft-repeat offers today.

### During the Week

- Rhythm threads sit at the **top of each day column**, grouped under a thin accent line or tinted background. Below them, your one-off threads (from the distaff, from other skeins, from inline adds) stack normally.
- You check them off one by one through the day, same swipe-right-to-weave gesture. No special interaction.
- If you don't finish one — say Thursday's "Workout" — it stays open. The Re-warp ritual on the following Monday will pick it up like any other carried thread.

### Editing the Rhythm

- The rhythm skein is a normal skein in the Skeins view: add threads, reorder them, delete them.
- Changes take effect **next time you cast** — they never mutate threads already placed on the week. You're editing the template, not the instances.

---

## How It Differs from Drafts (and Why Drafts Stay)

| | Drafts | Rhythm |
|---|---|---|
| **Scope** | A snapshot of a *whole week's* layout — threads on specific weekdays | A list of threads placed on *every* day |
| **Use case** | "My consulting-client week looks like this" / "My vacation week" — week-shaped templates | "These five things I do every single day" |
| **Cast result** | Each thread lands on its saved weekday | Each thread lands on all seven days |
| **Duplication** | Always creates new threads (by design — each cast is a new week) | Skips threads that already exist on a given day (rhythm threads carry over and shouldn't double) |
| **Count** | Many named drafts | One rhythm (V1) |

They solve different problems. Drafts stay exactly as they are. In fact, a draft should probably learn to **exclude rhythm threads** from its snapshot — you don't want to save "Meditate" into a draft when it's already going to be placed by the rhythm. That's a small refinement to `draftItemsFromWeek` (filter out threads whose skein is the rhythm skein).

---

## Visual Treatment — "The Givens vs. The Work"

This is the subtle separator that replaces a tasks-vs-habits categorization **without asking the user to think about it**:

- In the **Week view**, each day column renders rhythm threads first, in a lightly tinted block (a faint accent background — perhaps the skein's heat colour at low opacity, or a thin top-border). Below that block, a hairline or a small gap, then the rest of the day's threads.
- In the **Skeins view**, the rhythm skein carries its wave icon and is otherwise normal — just a skein with threads you can reorder.
- The **Tapestry** counts rhythm threads the same as everything else — they're woven cloth. No separate tracking. No streaks. Consistent with Loom's descriptive-never-scored philosophy.

---

## Data Model — Zero Notion Schema Changes

The rhythm skein is stored **device-local in localStorage**, alongside drafts:

```
loom_rhythm_skein = "Morning"    // the skein name that is the rhythm
```

The threads in that skein **already exist in the thread array** (the Notion database or the local store). The rhythm skein is just a pointer: "this skein's threads are the daily repeaters." When casting:

1. Read all threads where `skein === rhythmSkeinName` — that's the canonical list.
2. For each day of the new week, for each rhythm thread, check if a thread with the same `title` and `skein` already exists on that day.
3. If not, create it.

This means:
- **No new Notion properties.** The rhythm skein is just a skein. Its threads are just threads.
- **The rhythm flag is device-local** (like drafts, like the theme, like the vocabulary). Personal preference, not board data.
- **If you switch devices**, you'd re-flag your rhythm skein — same as re-setting your theme. Acceptable for V1.

---

## The Casting Flow (What Happens Under the Hood)

```
function castRhythm(threads, rhythmSkein, weekDays) {
  // 1. Get the canonical list from the rhythm skein
  const canonical = threads
    .filter(t => t.skein === rhythmSkein && !t.done)
    .sort(byOrder)

  // 2. For each day, check what's already there and fill gaps
  for (const day of weekDays) {
    const existing = threads.filter(t =>
      t.day === day.key && t.skein === rhythmSkein
    )
    const existingTitles = new Set(existing.map(t => t.title))

    for (const template of canonical) {
      if (!existingTitles.has(template.title)) {
        addThread({
          title: template.title,
          skein: rhythmSkein,
          day: day.key,
          order: template.order,   // preserves the rhythm's order
          done: false,
        })
      }
    }
  }
}
```

The canonical threads themselves (the ones in the rhythm skein with no `day` assigned) live in the distaff as reference entries — or, cleaner, they can just be a local-only list that mirrors the skein's current state. The exact storage is an implementation detail; the point is **no schema change, no new data type**.

---

## Interaction with Existing Features

### Re-warp Ritual
- Rhythm threads that were left unfinished from last week show up in the ritual like any thread. You can flick them forward, weave them done, or drop them. The new week's cast will place fresh copies regardless — the duplication guard checks `title + skein + day`, so a carried-forward Tuesday thread won't prevent a new Tuesday thread if the title matches (it will skip it — carried forward *is* the copy).

### Search & Focus
- Rhythm threads are searchable by title and skein, as usual.
- The "Hot few" toggle respects the rhythm section at the top: rhythm threads count toward the cap. This is correct — if your rhythm alone has 7 items, the hot few will show 6 of them, and the grey tail signals "maybe you're trying to do too much daily."

### The Tapestry
- No change. Rhythm threads are threads. They appear in the heatmap, the completion rate, the hottest-skein stat. If your rhythm skein is the hottest, the Tapestry says so. Descriptive, never prescriptive.

---

## Vocabulary (Lexicon Additions)

| Key | Loom voice | Plain voice |
|-----|-----------|-------------|
| `rhythm` | rhythm | routine |
| `Rhythm` | Rhythm | Routine |
| `rhythmLede` | A rhythm is the pattern the loom already knows — threads it places on the warp before you sit down. | A routine is your daily checklist — tasks placed on every day of the week automatically. |
| `castRhythm` | Weave your rhythm onto this week | Add routine to this week |
| `setAsRhythm` | Set as your rhythm | Set as your routine |
| `rhythmCast` | Your rhythm was woven onto the week. | Your routine was added to the week. |

---

## What This Doesn't Do (Intentionally)

- **No per-thread recurrence rules.** No "every Tuesday" or "every other day." That's calendar software. Loom is a weekly planner. The rhythm is all-days; the draft is per-weekday. Between the two, you cover the real use cases without RRULE complexity.
- **No streaks or streak-breaking anxiety.** A missed rhythm thread is just an open thread, same as anything else. The Tapestry shows your cloth descriptively. No red Xs, no guilt counters.
- **No "habit tracking" UI.** No dedicated view, no charts-per-habit, no completion-over-30-days graph. If you want to see how often "Meditate" gets done, the Tapestry's general completion rate covers it. A dedicated habit-tracking view is bloat that belongs in HabitNow.
- **No fields to configure per-rhythm-thread.** No "time of day", no "duration", no "reminder", no "category within the routine." A rhythm thread is a title and a position. That's it. Flow state, not admin state.

---

## Future Possibilities (Not V1)

- **Multiple rhythms** — weekday vs. weekend, or per-life-area ("Morning body", "Evening wind-down"). The flag just becomes a list.
- **Day-specific rhythms** — "this rhythm only casts on Mon–Fri." A small `days: [0,1,2,3,4]` mask on the flag.
- **Rhythm editing from Week view** — long-press a rhythm thread → "Edit in rhythm" to jump to the skein with that thread focused.
- **Draft awareness** — drafts automatically exclude rhythm-skein threads from their snapshot, so casting a draft + casting a rhythm never conflicts.

---

## Summary: Why This Works for Loom

| Design goal | How the Rhythm delivers |
|-------------|------------------------|
| **No new data types** | A rhythm is a skein + a localStorage flag. Threads are threads. |
| **No categorization burden** | You flag a skein once. Every thread you add to it is automatically a daily repeater. No per-thread decision. |
| **No field bloat** | Title, position. That's the whole config. |
| **No duplication anxiety** | The cast guard checks before creating. Carry-over threads count as existing. |
| **Visually distinct without being separate** | Rhythm threads sit at the top of each day, lightly tinted. No separate view, no modal, no tab. |
| **Plays with drafts, not against them** | Different scope (all-days vs. per-weekday), complementary, non-overlapping. |
| **Flow state over admin state** | One flag to set. One banner to tap. Then get to work. |
