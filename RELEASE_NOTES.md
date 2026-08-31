# OTWONO AI 0.1.5

**Windows users: upgrade.** In 0.1.4 and every release before it, the Windows
build started and then showed nothing — no agents, no templates, no connections,
empty dropdowns, and a Settings screen that loaded for ever. This release fixes
that. Linux and macOS were never affected.

---

## What was wrong

The local service checks the `Origin` of every request, so that a page in a
browser cannot reach into your data. The allow-list held the origin the
packaged application presents on macOS and Linux, `tauri://localhost`, and the
`https://` form of the Windows one.

Windows presents `http://tauri.localhost` — plain HTTP, because WebView2 cannot
register a custom scheme and Tauri uses a real one instead.

That origin was not on the list. So on Windows the interface was refused by its
own service, with a `403`, on every single request. Each screen fell back to
its empty state, which is why nothing looked broken — it looked like an
application with no data in it. Settings has no empty state, so it spun.

`http://tauri.localhost` is now on the list, alongside the `https://` form, so
the fix holds whether or not `useHttpsScheme` is ever set.

**This changes nothing about what is refused.** A page at any other origin still
gets a `403`, a lookalike like `http://tauri.localhost.evil.example` still gets
a `403` because matching is exact, and a request from an allowed origin without
a valid token still gets a `401`. All of that is asserted by tests and was
checked by hand against a running service.

## How it shipped

Honestly: the test for this asserted the macOS and Linux origin and the
development server, and never the Windows one. 500 tests passed on a build
whose interface could not talk to its own service. Nothing catches that except
starting the application on the platform it is built for, which nobody had done
until someone installed 0.1.4 and told us what they saw.

The test now names every origin the application can present, on every platform
it is built for, with the platform against each.

## If you are on Windows

Your antivirus may quarantine the installer, and quarantine it again when you
run it after restoring. That is what an unsigned binary with no download
history looks like to a reputation engine. Getting past Norton needs the file
added to *both* exclusion lists — scans, and Auto-Protect/SONAR — and possibly
the installed folder too. Verify the checksum first, then decide.

A code-signing certificate is the only real fix, and needs buying.

## Verifying this download

```bash
sha256sum --ignore-missing -c SHA256SUMS
```

## Installing

See `docs/INSTALL.md`. In short: install Ollama or LM Studio, pull a model,
install OTWONO, and connect it on the Connections screen.

## Please read

- **The installers are unsigned.** See above.
- **macOS has still never been launched by anyone.** Windows has now been run
  once, at 0.1.4, and that first run found the bug this release fixes. macOS has
  had no such run.
- **The application has never spoken to a real model runtime.** Every test
  drives a stub speaking the Ollama protocol.
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**
- **Without an embedding model**, search matches words rather than meaning.

Full detail in `STATUS.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 500 tests |
| Frontend | 25 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 15 |

Against a running service, each origin the application presents was checked by
hand: all four answer `200` and return the ten seeded agents; three hostile
origins and a missing token are refused.
