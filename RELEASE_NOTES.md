# OTWONO AI 0.2.0

The first release that adds something rather than fixing what was broken.
0.1.1 through 0.1.6 were checksums, documentation, and two bugs that made the
Windows build unusable. This one changes how the agents work and how you set
them up.

---

## The agents were told how to behave, but not what to produce

That was the real problem, and it did not show up in any test.

Their instructions ran from 41 to 119 words apiece: a few rules about honesty
and untrusted content, and nothing about output. Every test drives a stub that
speaks the Ollama protocol, and a stub returns whatever it was going to return
regardless of what it was told — so the instructions looked fine.

Against a real model it is the difference between a specialist and a chatbot
with a job title. Told only how to behave, a model invents the shape of its
answer, and the agent downstream receives something it cannot use.

Every template now ends with an explicit contract for what it hands back. The
Verification Agent already had one — *"Answer in this shape: 1. VERDICT"* — and
was the only one; that pattern is now everywhere.

| Agent | Before | Now |
|---|---:|---:|
| Executive Orchestrator | 119 | 270 |
| Planner | 41 | 196 |
| Researcher | 73 | 224 |
| Software Engineer | 61 | 239 |
| Writer | 54 | 219 |
| Designer | 46 | 241 |
| Budget Reviewer | 57 | 212 |
| Security Reviewer | 65 | 272 |
| Verification Agent | 85 | 243 |
| Human Task Coordinator | 90 | 239 |

Existing agents keep the instructions they have. These are the templates new
agents are created from; edit yours, or make a fresh one from a template to see
the new text.

## The Agents screen

**Choose a template from a list**, and read what it is for before committing to
it — rather than a row per template each with its own Copy button.

**Pick a model from what the connection actually offers.** It used to be a text
box. A model name your runtime does not have failed at the first message, a
long way from where the mistake was made.

**"Temperature" is gone.** It is a sampling knob that describes nothing you are
actually deciding, and the newest models reject the parameter outright. In its
place, three choices that mean something:

- *Stay close to the brief* — repeatable and literal, for review and figures.
- *Balanced* — the default.
- *Explore alternatives* — offers options, for design and drafting.

The number is still stored, so nothing is lost.

## Please read

- **The installers are unsigned**, and antivirus treats each release as a
  brand-new unknown file. Norton quarantines it on download and again on
  execution; getting past it needs both exclusion lists.
- **These instructions have never been judged against a real model.** They are
  written for one, and the stub cannot tell you whether they work. If the
  orchestration reads badly with a real model driving it, say so — the wording
  is cheap to change now that the shape is right.
- **macOS has still never been launched by anyone.**
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**

Full detail in `STATUS.md`. What comes next is in `ROADMAP.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 503 tests |
| Frontend | 25 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 20 — three of them driving this screen |
