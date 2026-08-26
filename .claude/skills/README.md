# `.claude/skills/` — project-level skills, version-controlled

Skills here are **loaded automatically by any Claude Code session opened in this repo**,
and they live in git. That makes this directory the source of truth for skills Radar-B
depends on.

## Why this exists (the trap it replaces)

Claude skills normally live on the **account**, not in a repo. Inside a Claude Code
session they appear at `~/.claude/skills/synced/<name>/SKILL.md` — but that path is a
**read-only mirror**, synced *down* from the account into an ephemeral container. Nothing
syncs back up.

Editing that mirror *looks* like it works: the bytes really are on disk, `grep` confirms
them, the mtime updates. But the container is reclaimed when the session ends, and the
skill that actually runs — in claude.ai, or in the next session — is the untouched server
copy. On 2026-08-21 several rounds of "fixed the skill" were made that way and none took
effect. The giveaways, both missed at the time:

- `~/.claude/skills/synced/manifest.json` still showed `"updatedAt": "2026-07-23…"` for
  the skill, weeks after the supposed edits.
- The live run's output was missing the mandatory `📡 N evenimente scrise/actualizate în
  Radar` line — a line added *specifically* so a skipped write couldn't hide. Its absence
  meant the running skill had never heard of the instruction, which is a different failure
  from the one being debugged.

A project-level skill has neither problem: it's in git, and it's what the session actually
loads.

## Two consumers, one file — resolved with a pointer stub (2026-08-26)

| Where you run it | What it uses | Action needed |
|---|---|---|
| **Claude Code, in this repo** | this file, directly | none — it just works |
| **claude.ai / Claude Chat** | a **stub** that fetches this file at run time | none, after a one-time paste |

Hand-uploading the Chat copy on every edit was the standing instruction here, and it did
not survive contact with reality: on 2026-08-26 the repo copy was 33.6 KB and the Chat
copy 24.7 KB, having drifted apart across several sessions. The rules that had just been
added to `recommend-in-bucharest` — a mandatory per-event link search, no programme-page
`Link`s, no invented date ranges — existed only in the repo, while every real run was
started from Chat. **A copy that must be manually re-synced is a copy that will be stale.**

So the Chat copy no longer holds the skill. It holds
[`claude-ai-stub.md`](recommend-in-bucharest/claude-ai-stub.md): frontmatter, and an
instruction to fetch this repo's `SKILL.md` from its raw GitHub URL and follow it. The
repo is public, so the canonical file **is** the URL — no build step, no `public/` copy,
nothing to keep in sync:

```
https://raw.githubusercontent.com/jormania/app-playground/main/.claude/skills/<name>/SKILL.md
```

**`git push` is now the deploy mechanism for skill changes.** The URL points at `main`, so
a push takes effect on the next run with no paste. The trade is that a bad push is live
immediately.

Two things in the stub must not drift: the frontmatter `description` (that string is what
triggers the skill — keep it byte-identical to `SKILL.md`'s) and the URL. It contains no
part of the procedure, so there is nothing else that *can* drift.

Re-paste the stub only if one of those two changes. Otherwise, edit `SKILL.md` here and
push.

**Caveat worth knowing:** a skill body is loaded as trusted instruction, whereas a fetched
document is ordinary web content — a model may skim or summarise it rather than execute it
step by step. The stub addresses this explicitly (it states the document is Gabriel's own,
to be treated as if written inline) and tells the run to **fail loudly** rather than
reconstruct the procedure from memory, since a remembered run would silently drop exactly
the rules above. If following-fidelity ever proves unreliable, the fallback is running the
skill from the app via the API — priced at ~$5–8/run and deferred for that reason — not a
second hand-maintained copy.

When both exist, Claude Code lists the project-scoped one with a path prefix, so they stay
distinguishable.

## What's here

| Skill | Account `skillId` | Depended on by |
|---|---|---|
| `recommend-in-bucharest` | `skill_01QWuvTkq2cz2JsR3NkCNa5i` | **Radar-B** — its only ingest path. Radar-B reads the 📡 Radar Notion database that this skill's Step 4 writes. See [`RADAR_B.md`](../../RADAR_B.md). |

`wanderlist` (`skill_01UXfuZdMQvkBhGG1TnxsdcA`) is referenced by both Radar-B and this
skill but isn't mirrored here — add it the same way if it ever needs changing.

## Running the flow from Claude Code needs one more thing: network access

The skill fetches seven Romanian publications (`b365.ro`, `zilesinopti.ro`,
`hartamuzeelor.ro`, `curatorial.ro`, `buletin.de`, `hotnews.ro`,
`recomandata9.substack.com`). In a remote Claude Code session those are subject to the
**environment's egress policy**, and by default they are denied:

```
$ curl https://b365.ro/
curl: (56) CONNECT tunnel failed, response 403

$ curl -sS "$HTTPS_PROXY/__agentproxy/status"   # recentRelayFailures
{ "kind": "connect_rejected",
  "detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
  "host": "b365.ro:443" }
```

That is an organization/environment policy denial, not something to route around. To run
the full flow from Claude Code, widen the environment's network policy to allow those
hosts — see https://code.claude.com/docs/en/claude-code-on-the-web. Web *search* works
regardless; it's only direct page fetches that are blocked.
