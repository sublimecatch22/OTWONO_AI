# Roadmap

What is being built next, in the order it should be built, and why that order.

Written after the first real use of OTWONO on Windows. Everything here comes
from that session; nothing is speculative feature-planning.

Each phase is meant to ship on its own — a version you can install and judge —
rather than as part of one long branch that lands months later.

---

## Before anything: two decisions that change the work

These are not mine to make, and picking wrong is expensive later.

### D-1 — Are Teams a new thing, or are Workspaces already Teams?

> **Answered: Teams are Workspaces.** Recorded as D-017 in `DECISIONS.md`.

Workspaces already exist and already do most of what "teams" describes: an
Office, Lab, Boardroom or Think Tank is a named group of agents with members
(`workspaces`, `workspace_members`) that runs sessions.

Two ways forward:

| | What it means | Cost |
|---|---|---|
| **Teams *are* Workspaces** | Rename in the interface, add an orchestrator slot and a picker, keep one concept | Small. No migration. One idea for a user to learn. |
| **Teams are separate** | A Team is a reusable roster; a Workspace is a place that *uses* one | Larger. Migration, two overlapping concepts to explain. |

**Recommendation: Teams are Workspaces.** The screens you want — pick a team in
chat, run a team on a project — are a picker over something that already
exists. A second concept that is 90% the same would be the harder thing to use,
not the more powerful one.

### D-2 — What "temperature" should become

> **Answered and shipped in 0.2.0.** The agent form offers *Stay close to the
> brief · Balanced · Explore alternatives*; the number is kept under Advanced.

You are right that it means nothing here. It is a sampling knob, and on the
newest models it is not even accepted.

**Recommendation:** remove it from the main agent form. Put a single plain
control in its place — *Stay close to the brief* ↔ *Explore alternatives* —
and keep the raw numbers under **Advanced**, for the people who want them.

---

## Phase 1 — The Agents screen, made usable

Small, self-contained, visible immediately. No schema change.

- **Template picker becomes a dropdown.** Choose a template, then edit.
- **Much better default instructions.** The current ones are thin. Each of the
  ten agents gets instructions written for the job: what it owns, what it must
  refuse, what "done" looks like, and what to hand back. This is the single
  biggest lever on output quality and costs nothing to ship.
- **Model per agent**, surfaced properly on the form rather than buried.
- **Temperature → the plain control from D-2.**

*Ships as: 0.2.0.*

---

## Phase 2 — The agent tree, and teams that can be pointed at work

The structural change. Needs a migration.

- **Hierarchy.** An agent gains a role and a parent. The screen becomes a tree:
  orchestrator at the top, specialists beneath. Every agent stays fully
  editable.
- **An orchestrator worth the name.** A real delegation prompt: read the goal,
  decide which specialists are needed, dispatch, hold the thread, resolve
  disagreement, decide when it is finished. It should be able to use *any*
  connected model, choosing per step rather than being pinned to one.
- **Teams are selectable wherever an agent is.** Chat, project, task. Pick
  "Design team" instead of one agent and the orchestrator runs it.

**Done so far:**

- ✅ *Hierarchy.* `agents.parent_agent_id` (migration 3), refused if it would
  close a loop or point at an agent that does not exist. Deleting a manager
  frees its reports rather than deleting them. The screen draws a nested tree
  and the form has a **Reports to** picker that never offers an agent its own
  reports.
- ✅ *An orchestrator that delegates to its own team.* Planning now offers the
  orchestrator only the agents that report to it, rather than everyone in the
  building. Skipped when it has no reports, so a flat roster behaves exactly
  as it did.

- ✅ *A delegation prompt that actually delegates.* The planning prompt listed
  the team but never asked for a role per task, so a model could name nobody
  and every task fell back to the orchestrator. It now names the team as a
  list, requires a role copied from it, says that an invented role is
  discarded, and says not to pile every task on one person.
- ✅ *Teams selectable wherever an agent is.* Chat has **Answered by**, a
  project has **Run by**, and a task row has **Hand it to** — each offering
  agents and teams, a team resolving to whoever is in charge of it. A team with
  nobody in charge is shown and disabled with the reason rather than hidden.
- ✅ *Per-step model choice* needed nothing: each agent carries its own
  connection and model, and a task runs under the agent it was assigned, so a
  plan spread across four agents is already spread across up to four models.

**Phase 2 is done.** What is not here, deliberately: chat does not run a
multi-agent loop. Picking a team in chat means the coordinator answers with the
team's shared instructions. Several agents actually arguing something out is
what a Boardroom session already does, and inventing a second engine for it in
the chat pane would be duplication, not a feature.

*Depends on: D-1, D-2, Phase 1.*
*Ships as: 0.3.0.*

---

## Phase 3 — Tasks become a real screen

Today the Tasks tab redirects to Projects, and a `Task` cannot exist without a
`project_id`. That is the whole problem.

- **Standalone tasks.** `project_id` becomes optional.
- **Task lists.** Group tasks; reorder; combine.
- **Attach a list to a project** — the tasks keep their identity.
- **Assign anywhere:** to yourself, to an agent, to a team, or out to the
  marketplace.

*Depends on: Phase 2 for team assignment.*
*Ships as: 0.4.0.*

---

## Phase 4 — Connections: more providers, and your own APIs

Two separate pieces of work that share a screen.

### 4a — First-class provider adapters

Anthropic and OpenAI as named providers with their own adapters, keys in the OS
credential vault, capabilities probed rather than guessed.

**On using a Claude Max or ChatGPT Plus subscription instead of an API key:**
see *What this roadmap will not do* below. The short version is that I will
build the API-key path and not the browser-automation one.

### 4b — Register any HTTP API for agents to use

You describe this as "add almost any API for the AI to use". That is a tool
registry, and it is the most security-sensitive thing on this list — it is the
feature that turns OTWONO from something that reads and writes locally into
something that can act on the wider internet on your behalf.

It has to be built on the permission engine that already exists:

- Each registered API is a **capability**, granted per agent, revocable, and
  visible in one place.
- Credentials go in the OS vault, never the database, never an agent package.
- Anything that leaves the device is **shown before it goes**, per the existing
  `leaves_device` rule.
- The emergency stop covers it, because it goes through the same engine.
- Nothing is granted by default.

*Ships as: 0.5.0.*

---

## Phase 5 — The chat workspace

Large frontend work, almost no backend.

- **Split panes**, and chats that can be **floating windows** — resize,
  minimise, maximise, close.
- **Many teams, many concurrent sessions.** One team of "The Office", one of
  scientists, one of comedians.
- **A master chat that broadcasts** to every open session at once, with each
  team answering in its own thread — or talk to any one of them directly.

The broadcast is the interesting part and the one to get right: it is one
prompt fanned out to several teams, each with its own history, running
concurrently against possibly different models.

*Depends on: Phase 2.*
*Ships as: 0.6.0.*

---

## Phase 6 — Accounts, profiles, and an admin panel

The largest external dependency, which is why it is late rather than early.

- **Account section replaces the Activity tab**; Activity moves into Settings.
- **On launch, with a connection:** sign in, sign up, or stay offline. Offline
  keeps everything local and disables what genuinely needs a server, and says
  which.
- **One profile across all OTWONO apps and services**, so Relay and anything
  after it know who they are dealing with.
- **Admin account and controls panel.**

**This cannot ship before a relay is actually deployed.** Today none is: the
relay runs and is tested, but no public instance exists, it cannot send email,
and registration hands back the verification token in the response instead.
Accounts are a server product with a client attached, and the server has to
exist first — a host, TLS, a mail service, and a decision about where user data
lives and under whose terms.

*Depends on: a deployed relay.*
*Ships as: 0.7.0.*

---

## Phase 7 — OTWONO Relay takes over the marketplace

Relay is being built as a separate application. The work here is to make the
handover cheap whenever it is ready.

**Do early, in Phase 3 (it is small):** define the boundary. A stable contract
for posting work, receiving applications, tracking state and settling. The
in-app marketplace then sits behind that contract instead of being wired
through the screens.

**Do when Relay ships:** swap the implementation. The Marketplace tab becomes a
Relay client. Everything about moderation, blocked categories, rate limits and
human escalation moves with it.

The **completion contract you asked for** — terms agreed by both parties before
work starts — belongs to Relay, and should be designed there rather than
half-built here and migrated.

*Depends on: Relay existing.*

---

## What this roadmap will not do

**Driving claude.ai or chatgpt.com through a hidden browser to use a
subscription.**

I understand the appeal: you pay for Claude Max, and paying again per token
feels like paying twice. But I am not going to build it, and I would rather say
so plainly than build it badly or quietly.

- **It breaks the terms of both services.** Consumer subscriptions cover
  interactive use through the vendor's own interface. Programmatic access is
  what the API is licensed for. This is not a technicality that automation
  routes around; it is the distinction being sold.
- **The risk lands on your users, not on us.** A signed-in account driven by
  automation is the account that gets suspended. Shipping this would put every
  OTWONO user's Claude or OpenAI account at risk, using their credentials.
- **It would not stay working.** It depends on page structure that changes
  without notice, and on getting past bot detection built specifically to stop
  it. Every silent breakage would look like an OTWONO bug.
- **It contradicts what OTWONO is.** This project refuses to represent an AI as
  a human, and shows the user everything that leaves the device. A hidden
  browser logging in as you, pretending to be you, is the opposite.

**What I will build instead:** proper adapters for Anthropic and OpenAI, keys
in the OS credential vault, with per-provider spend visible so you can see what
you are actually spending rather than guessing.

**If subscription-backed access matters commercially**, that is a conversation
with Anthropic and OpenAI about terms — not something to solve in code. It may
well be possible; it is just not possible unilaterally.

---

## Order at a glance

| Phase | What | Blocked by | Version |
|---|---|---|---|
| 1 | Agents screen: dropdown, real instructions, per-agent model ✅ | D-1, D-2 | 0.2.0 |
| 2 | Agent tree, orchestrator, teams selectable ✅ | Phase 1 | 0.3.0 |
| 3 | Tasks as a real screen · Relay boundary defined | Phase 2 | 0.4.0 |
| 4 | Anthropic/OpenAI adapters · your own APIs, permissioned | — | 0.5.0 |
| 5 | Split panes, floating chats, master broadcast | Phase 2 | 0.6.0 |
| 6 | Accounts, profiles, admin panel | **A deployed relay** | 0.7.0 |
| 7 | Relay replaces the marketplace | **Relay shipping** | — |

Phase 4 is independent of 2 and 3 and can be pulled forward if connecting
Claude matters more than teams do.

---

## Still true, and unchanged by any of this

- Nobody has launched the macOS build.
- The application has never spoken to a real Ollama or LM Studio. Every test
  drives a stub. Phase 1's better instructions should be judged against a real
  model, not the stub.
- The installers are unsigned, and antivirus deletes them. A code-signing
  certificate is the only fix and has to be bought.
