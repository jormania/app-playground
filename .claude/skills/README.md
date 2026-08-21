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

## Two consumers, one file

| Where you run it | What it uses | Action needed |
|---|---|---|
| **Claude Code, in this repo** | this file, directly | none — it just works |
| **claude.ai / Claude Chat** | the account copy | upload by hand, see below |

To update the Chat copy: claude.ai → **Settings → Capabilities → Skills** → find the
skill → replace its content with the file here. Verify it took by checking that the
skill's `updatedAt` in `~/.claude/skills/synced/manifest.json` moves to today.

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
