# OTWONO AI 0.1.3

The first release since 0.1.0 that changes how the application behaves. 0.1.1
and 0.1.2 were packaging and documentation fixes; this one alters what the
local API does with a request it does not fully understand.

---

## What changed

**A request naming a field the endpoint does not have is now refused.**

Before this release, creating an agent with `system_prompt` instead of
`system_instructions` returned `200` and an agent whose instructions were empty
and whose temperature was the default. The request was accepted, the intent was
discarded, and a success code was put on top of it. Serde ignores what it
cannot place, and every request type in the service inherited that.

Now the same request answers `422` and says what it accepts:

```
unknown field `system_prompt`, expected one of `name`, `role`, `description`,
`icon`, `system_instructions`, `provider_connection_id`, `model`, `parameters`, …
```

All 53 request types in the local service are covered.

**This extends to the import formats, deliberately.** A settings file
containing a key this version cannot apply is refused rather than partly
applied. Telling someone their settings were restored while quietly discarding
part of the file is the worse failure. Both the settings export and the agent
package carry `schema_version`, so a genuinely newer file is refused by an
explicit version check rather than being mangled.

## If you script against the API, read this

Two things that used to be silently tolerated are now errors:

| | Before | Now |
|---|---|---|
| Unknown field in a request body | ignored, `200` | `422`, naming the field and listing the valid ones |
| Unknown query parameter | ignored | `400` |

Nothing the shipped interface sends is affected — the end-to-end suite drives
the real interface against the real service and passes unchanged. This matters
only if you are calling the API yourself.

The reasoning, and the cost, are recorded as decision D-016.

## Verifying this download

```bash
sha256sum --ignore-missing -c SHA256SUMS
```

Every file you downloaded reports `OK`.

## Installing

See `docs/INSTALL.md`. In short: install Ollama or LM Studio, pull a model,
install OTWONO, and connect it on the Connections screen.

## Please read

- **The installers are unsigned.** Windows SmartScreen will warn about an
  unknown publisher; macOS needs right-click → *Open* on first launch. Signing
  needs certificates the project owner must buy.
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.** The relay runs and is tested, but no public
  instance exists and nothing in the product points at one.
- **Without an embedding model**, search matches words rather than meaning. The
  interface says so where it matters.
- **Windows and macOS have not been run by anyone.** Both are built by CI and
  both builds succeed, but no one has installed or launched them. Only the
  Linux `.deb` has been installed and driven from a published release.

Full detail in `STATUS.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 500 tests |
| Frontend | 25 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 15 |

`./scripts/verify.sh` runs all of it, plus formatting, types and lints.

The 0.1.2 `.deb` was installed and driven from the published release on a clean
machine: checksums verified, `dpkg -i` clean with no unmet dependencies, first
run usable in two seconds, ten agents seeded, a folder authorised and indexed,
and retrieval returning the right file for two different queries. Everything
survived a restart. `dpkg -r` removed the program and left the user's data
intact. That run is what found the defect this release fixes.
