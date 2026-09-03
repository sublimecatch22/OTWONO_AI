# OTWONO AI 0.4.0

A team of agents now argues a question out over as many rounds as it takes,
and the orchestrator decides when the answer is good enough. This is what the
application is for, so it has its own screen — second in the navigation, after
Chat.

---

## What was already there, and what was missing

A session engine ran three stages in a fixed line: every agent states a
position, every agent critiques the others, the chair writes a synthesis. It
recorded who said what and kept the dissent rather than smoothing it over.

That is one round. The chair wrote up whatever came back and never got to say
*"this is not good enough yet, and here is exactly what is missing."* There was
no going back and forth and no judgment gate — the part that matters.

## The loop

Positions and critique now repeat. At the end of each round the orchestrator
returns a verdict, and if it is not satisfied it names the gaps; the next round
asks each agent to revise **against those gaps** rather than start again.

It ends three ways, and they do not mean the same thing:

| | |
|---|---|
| **Settled** | The orchestrator judged the answer good enough to act on. |
| **Not settled — went in circles** | The same gaps came back two rounds running. The team could not deliver them, and a third attempt would not change that. |
| **Not settled — ran out of rounds** | Still making progress when the budget ran out. Worth re-running with more rounds. |

## Why there is a round budget

"Until the best result is agreed" is unbounded, and every round is one model
call per agent plus a critique. On a model running on your own machine, a
four-agent team at six rounds is tens of minutes. Models also tend to converge
on *agreeing* rather than on being *right*, so a loop with no stopping rule can
restate itself indefinitely.

The orchestrator's judgment is the stopping rule. The budget is only the
backstop: three rounds by default, six at most, chosen when you start one.

## A result that did not settle is never shown as agreed

The chair is told plainly when it is writing up something unsettled, and asked
not to write it as though the group agreed. The screen labels it and lists what
is still missing.

An unparseable verdict counts as **not** settled. Guessing that a model meant
to stop is how a half-finished answer becomes a finished one — and only that
direction is unbounded, because the round budget bounds the other.

## Any team can deliberate

This used to be refused to anything but a Boardroom or a Think Tank. The kind
shapes what the chair is asked to produce; it never decided who was allowed to
argue, and the restriction was arbitrary. An Office can now argue something
out like anyone else.

## Two bugs found on the way

**Member counts went stale.** Adding an agent to a team refreshed only that
team's own page, never the lists carrying its member count. The sidebar showed
"0 agents" for a team with one, and — because a deliberation needs at least two
agents — adding an agent and then trying to deliberate was refused for a team
that was in fact big enough.

**A new tab would have been invisible to you.** The tabs you see are a stored
list, so a screen added after you first ran the application never appears.
Migration 4 adds Deliberations to that list once. Hide it afterwards and it
stays hidden; a preferences row that is not valid JSON is left alone.

## Please read

- **The installers are unsigned**, and antivirus treats each release as a
  brand-new unknown file. Norton quarantines it on download and again on
  execution; a previous exclusion does not cover this one.
- **This release changes the database schema** (migration 4). A timestamped
  copy of your database is taken before it runs, into `backups/` beside it.
- **A deliberation takes as long as your model does.** Every agent answers in
  turn, twice a round. Start with two or three agents and two rounds before
  turning it up.
- **None of these prompts has been judged against a real model.** The verdict
  contract, the revision prompt and the agent briefs are written for one; the
  test stub cannot tell you whether they hold up.
- **macOS has still never been launched by anyone.**
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**

Full detail in `STATUS.md`. What comes next is in `ROADMAP.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 538 tests |
| Frontend | 48 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 27 |

The two new end-to-end tests drive the loop rather than the happy path: the
fake runtime **refuses to settle on the first round**, so the test proves a
second round actually happens and that the orchestrator's stated gap reaches
the agents revising against it.
