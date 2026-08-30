# OTWONO AI 0.1.1

A packaging fix. **The application itself is unchanged from 0.1.0** — same
features, same behaviour. If 0.1.0 is working for you there is no need to
upgrade, though nothing is lost by doing so.

---

## What changed

**`sha256sum -c SHA256SUMS` now works.** GitHub replaces spaces with dots in an
asset's filename as it uploads, so 0.1.0's checksum file named
`OTWONO AI_0.1.0_amd64.deb` while the release actually served
`OTWONO.AI_0.1.0_amd64.deb`. Anyone following the verification step in
`docs/INSTALL.md` got:

```
sha256sum: 'OTWONO AI_0.1.0_amd64.deb': No such file or directory
OTWONO AI_0.1.0_amd64.deb: FAILED open or read
```

The hashes were correct; only the names disagreed. The release now names the
files as they are served, so the check passes.

**The release build refuses a half-finished version bump.** Nine files state
the version. If any of them disagrees with the version being released, the
build stops before anything is compiled, rather than producing installers that
report one number under a release named for another.

**`docs/INSTALL.md`** now says that a `No such file` line for a platform you
did not download is expected, not a failed check.

## Verifying this download

```bash
sha256sum -c SHA256SUMS
```

Files you downloaded report `OK`. Files you did not report `No such file or
directory` — that is expected.

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

Full detail in `STATUS.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 495 tests |
| Frontend | 18 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 15 |

`./scripts/verify.sh` runs all of it, plus formatting, types and lints.

The 0.1.0 `.deb` was also installed and run from the published release: it
installs cleanly, starts, seeds its agents, serves `/health` unauthenticated,
refuses `/api` without a token, refuses a hostile `Origin` even with one, and
listens on loopback only.
