---
name: ledger
description: Use when work crosses between this repo and the iOS client (muzzamilkhan/learnr-ios) - answering a question the iOS side has raised, recording a decision or a shipped change it could be contradicted by, checking what it has done, or raising something you need from it. The shared ledger on this machine replaced the GitHub issues the two repos used to raise on each other. Also use at the start of a session that touches the API, the contract, the engine or the content packs, since those are what the other side depends on.
---

# The ledger

One file, two agents. This repository is worked on here; `learnr-ios` is worked
on from a Mac that reaches this machine over SSH. Neither repository is ever
edited from the other side's session, so the ledger is where they hand work over
instead.

- `/home/muzza/code/learnr-ledger/LEDGER.md` - the ledger
- `ledger` - the script, on `PATH`, which locks, stamps and commits every write
- `answer` - the headless runner beside it (below)

It sits outside both repositories on purpose: `learnr` is public and a push to
it deploys, so the ledger belongs to neither side and ships nothing.

## Start by reading it

```bash
ledger read      # the whole thing - protocol, both "Now" blocks, open items, log
ledger items     # just what is outstanding across the boundary
```

**The ledger is the current state of the other side; a clone is not.** iOS
development happens elsewhere, so `~/code/learnr-ios` here is evidence of what
has *shipped*, not of what exists. Never answer a question about the iOS side
from that checkout without reading the ledger first.

## Answering a question from iOS

This is the main thing you do here. When an item is raised **for `web`**, a
headless Claude fires in this repository automatically - `ledger ask` spawns
`answer <id>`, which logs to `~/code/learnr-ledger/runs/<id>.log`. So most
questions are already answered by the time you look. Your job when you *are* the
one answering:

```bash
ledger answer L4 "<the answer in one line>" <<'EOF'
The full answer. Name exact files, functions and endpoints.
EOF
```

Three rules, and the third is the one that matters:

1. **Answer from the source, not from memory.** The engine under `src/lib` is
   the oracle for the Swift port, `apps/api` owns the schema and the contract at
   `apps/api/contract/openapi.yaml`, and `CLAUDE.md` and
   `docs/superpowers/specs/` carry the decisions and why they were made.
2. **Give the reasoning, not only the behaviour.** The port has to reproduce
   *why*, or it reproduces the code and drifts at the first change. "A speed run
   writes no `Attempt`" is half an answer; "because an `Attempt` carries a
   curriculum topic and a school year, which `add.hard` does not have" is the
   whole one.
3. **Escalate anything the source cannot settle.** A product call, a priority
   call, a trade nobody has made yet:

```bash
ledger escalate L4 "why this is Muzzamil's call, and what the options are"
```

   Then **say so in your reply to Muzzamil** - the ledger marks it
   `**for Muzzamil**`, but nothing puts it in front of him except you. Inventing
   an answer to an open-ended question is how the two sides end up shipping
   different products.

## Recording your own side

```bash
ledger status web <<'EOF'
What is shipped, what is in flight, what is blocked.
EOF

ledger entry web decision "..." <<'EOF'   # progress | direction | decision
EOF
```

Update the `Now` block when it stops being true, and never touch the iOS one.
Log a decision when it is one the other side could be contradicted by - not
every commit. **The manifest version, the contract, the digests and the engine's
output are the four things iOS is downstream of**: a change to any of them is
worth an entry, because the iOS side finds out otherwise by a red digest.

## Asking iOS for something

```bash
ledger ask web ios "what you need, and what you are doing in the meantime"
ledger close L2 "how it was resolved"
```

The items table is **cross-boundary only** - what one side needs *from* the
other. This repository's own to-do list does not go in it.

## What not to do

- Do not edit `LEDGER.md` by hand. The script locks and commits; a hand edit
  from one side can land on top of the other's.
- Do not commit to `learnr-ios`, ever, and do not raise a GitHub issue on it.
  Both are what the ledger replaced.
- Do not close an item raised for iOS on their behalf.
