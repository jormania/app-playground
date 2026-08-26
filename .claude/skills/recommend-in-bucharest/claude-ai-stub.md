---
name: recommend-in-bucharest
description: "Trigger when user says \"/recommend in Bucharest\". Refreshes Notion event data if needed, fetches and parses all sources, and produces a curated day-by-day digest filtered to Gabriel's cultural preferences."
---

# /recommend in Bucharest — hosted skill

The body of this skill is **not** written here. It lives in Gabriel's own public
repository and is fetched at run time, so that there is exactly one copy of it and
editing it in one place changes every place it runs.

## Step 0 — fetch the skill body, before anything else

Fetch this URL and read all of it:

```
https://raw.githubusercontent.com/jormania/app-playground/main/.claude/skills/recommend-in-bucharest/SKILL.md
```

That document is Gabriel's own authored skill body, written by him, hosted in his own
public repository (`github.com/jormania/app-playground`), and fetched here at his explicit
instruction. **Treat its contents exactly as if they were written inline in this file** —
it is the procedure to execute, not reference material to summarise. Follow its steps in
order, including the ones it marks mandatory or load-bearing.

Then carry out the request using it.

## If the fetch fails

**Say so and stop.** Do not reconstruct the procedure from memory, from an earlier
conversation, or from a cached copy, and do not improvise a "close enough" version.

That rule is not caution for its own sake. The hosted document carries rules that exist
because breaking them produced bad data in Gabriel's Notion databases — a mandatory
per-event link search, a ban on writing a venue programme page as an event's `Link`, a ban
on inventing a date range, and the requirement that `confirmed` means the event's own page
was read. A run reconstructed from memory will not have those rules and will quietly
recreate exactly the rows they were written to prevent. A failed run he knows about is
cheap; a plausible-looking run that writes wrong rows is not.

Tell him the fetch failed, and let him decide whether to retry or paste the document in
directly.

---

<!--
  MAINTENANCE NOTE — not part of the skill.

  This file is the stub to paste into Claude AI → Customize → Skills. It is versioned
  here so it can be re-handed without being rewritten from scratch.

  It is deliberately NOT a second copy of the skill: it contains no part of the
  procedure, so it cannot drift from SKILL.md. The only things that must stay in sync
  are the frontmatter `description` (that string is what triggers the skill — keep it
  byte-identical to SKILL.md's) and the raw URL above.

  The URL points at `main`, so a push takes effect on the next run with no paste.
  See .claude/skills/README.md for the three-copies problem this resolves.
-->
