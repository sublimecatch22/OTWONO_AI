# OTWONO AI 0.2.1

A small release with one purpose: you can now see which agent is doing which
task, without opening the activity log and reading JSON.

---

## The delegation was real, and invisible

The orchestration engine does share work out. Planning asks the orchestrator
for a task list, each task can name the role that should do it, and that role
is matched against the agents you actually have — a role it invents is dropped
rather than conjured. Every task then runs under the agent it was assigned.

None of that reached the screen. The task rows showed a title, a state badge
and the output; the assignment existed only in the `agent` field of a
`task.executed` entry in the activity log. That is not somewhere a person
should have to look to answer "who is doing this".

Every task row — on the project page and on the Tasks tab — now says who has
it. Five cases, because all five happen:

| Situation | The row says |
|---|---|
| Assigned to an agent that exists | *Assigned to Researcher* |
| Assigned to one since deleted | *Assigned to an agent that no longer exists* |
| The agent list has not loaded | *Assigned to an agent* |
| Nobody assigned | *Nobody is assigned, so the orchestrator (…) will do it* |
| Nobody assigned, no orchestrator | *Nobody is assigned, and there is no orchestrator to fall back on* |

The fourth line is the one that matters. When a task has no assigned agent the
engine falls back to the project's orchestrator, so the work still gets done —
saying only "unassigned" would have implied the opposite. The fifth is the one
combination that cannot run at all; it is now visible before you press the
button rather than as an error afterwards.

## The Tasks tab was hiding queued tasks

It filtered on ready, running, verifying and blocked. A task waiting on the one
before it is `queued`, so it fell into no section and rendered nowhere — under
a heading that says *Everything in flight, across every project*. On a
two-task plan with a dependency, half the plan was missing.

Found by the new end-to-end test, which read the first task's agent and then
could not find the second task at all.

## If you are checking whether delegation works

Staff the workspace before you plan. The planner can only assign work to agents
that exist, matched by role or by name. An office holding nothing but an
orchestrator will produce a plan where every row reads *"Nobody is assigned, so
the orchestrator will do it"* — which looks exactly like a model refusing to
delegate, for a reason that has nothing to do with the model.

## Please read

- **The installers are unsigned**, and antivirus treats each release as a
  brand-new unknown file. Norton quarantines it on download and again on
  execution; getting past it needs both exclusion lists. A previous exclusion
  does not cover this file.
- **The agent instructions rewritten in 0.2.0 have still not been judged
  against a real model.** Nothing here changes them.
- **macOS has still never been launched by anyone.**
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**

Full detail in `STATUS.md`. What comes next is in `ROADMAP.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 503 tests |
| Frontend | 30 — seven of them over this wording |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 21 — one staffing an office and reading both agents' names off the rows |

The end-to-end test was watched failing against the previous build before it
was kept, so it is not passing by accident.
