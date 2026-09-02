# OTWONO AI 0.3.0

Agents can now report to one another, and a team can be pointed at work
anywhere an agent could be. This is Phase 2 of `ROADMAP.md`, whole.

---

## A team is a workspace

The first decision, because everything else depended on it. An Office, Lab,
Boardroom or Think Tank is already a named roster of agents with somebody in
charge. That is a team. So there is no `teams` table, no migration for one, and
no second idea to learn — picking a team is picking a workspace, and its
coordinator is the one who answers. Recorded as **D-017** in `DECISIONS.md`.

## Agents report to agents

`agents.parent_agent_id`, migration 3. Nullable, so every agent you already
have is untouched: a flat list is a forest of roots.

The agents screen draws a nested tree, and the form has a **Reports to**
picker. The constraints are where the work went:

- A parent must exist, and an agent cannot report to itself.
- **A reporting line that would close a loop is refused where it is created**,
  by walking up from the proposed parent until it runs out or meets the agent
  being moved. Not tidiness: the tree is walked to draw the screen and to build
  a prompt, and a cycle hangs both.
- **Deleting a manager frees its reports rather than deleting them.** They
  become roots and keep every other setting.
- The picker never offers an agent its own reports — the service would refuse
  it, and offering a choice only to refuse it is worse than not offering it.
- Anything malformed is flattened, never hidden. An agent whose manager is
  archived appears at the top; a cycle that somehow reached the database is
  broken rather than followed. Nothing given to the screen can disappear
  from it.

## The orchestrator delegates to its own team

Two changes, and the second is the one that mattered.

Planning used to offer every agent in the building. It now offers the agents
that report to the orchestrator — skipped when it has none, so a flat roster
plans exactly as it did. Narrowing to a team must never narrow to nobody.

And the planning prompt had a hole in it. It listed the available roles and
then never mentioned them again: nothing asked for a role per task. A model
could name nobody, every task would fall back to the orchestrator, and the
result reads exactly like a model refusing to delegate. The prompt now names
the team as a list, requires a role copied from it exactly, says that an
invented role is discarded, and says not to hand every task to one person.

## Teams are selectable wherever an agent is

| Where | Control |
|---|---|
| Chat | **Answered by** |
| A project | **Run by** |
| A task row | **Hand it to** |

Each offers agents and teams. A team resolves to whoever is in charge of it,
because one agent has to do the work.

A team with nobody in charge is offered and **disabled, with the reason in the
label** — hiding it would read as a missing feature rather than a gap in the
team. Choosing a team for a project sets its workspace too, since a team is a
workspace; choosing a single agent leaves the workspace alone, because where a
project lives is not the same question as who runs it.

Handing over a task needed an endpoint, so tasks have one. It refuses a task
that is running, being verified or finished, naming the state that stopped it,
and the control is not offered on those rows — the refusal is a backstop, not
the first you hear of it.

## What is deliberately not here

**Chat does not run a multi-agent loop.** Picking a team in chat means the
coordinator answers, with the team's shared instructions. Several agents
actually arguing something out is what a **Boardroom session** already does —
positions, then critique, then a synthesis by the chair. A second engine for
that inside the chat pane would be duplication, not a feature.

**Per-step model choice needed nothing new.** Each agent carries its own
connection and model, and a task runs under the agent it was assigned, so a
plan spread across four agents is already spread across up to four models.

## Please read

- **The installers are unsigned**, and antivirus treats each release as a
  brand-new unknown file. Norton quarantines it on download and again on
  execution; a previous exclusion does not cover this one.
- **This release changes the database schema** (migration 3). A timestamped
  copy of your database is taken before it runs, into `backups/` beside it.
- **The agent instructions rewritten in 0.2.0 have still not been judged
  against a real model**, and neither has the new planning prompt. They are
  written for one; the test stub cannot tell you whether they work.
- **macOS has still never been launched by anyone.**
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**

Full detail in `STATUS.md`. What comes next is in `ROADMAP.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 518 tests |
| Frontend | 48 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 25 |

Four of the end-to-end tests are new in this release: putting a Researcher
under an orchestrator and reading the nesting back out, answering a chat as a
team, a leaderless team shown and refused, and a planned task handed to a
different agent and then to nobody.
