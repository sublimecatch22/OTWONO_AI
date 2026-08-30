# OTWONO AI 0.1.2

A documentation fix. **The application itself is unchanged from 0.1.0** — same
features, same behaviour. Upgrade only if you want the corrected instructions;
nothing in the running product differs.

---

## What changed

**The documented data directory was wrong on all three platforms.** The path
comes from `ProjectDirs::from("com", "OTWONO", "OTWONO AI")`, and the
`directories` crate spells that differently per platform. The documentation
quoted a hand-written guess instead of what the code produces:

| | Documented | Actual |
|---|---|---|
| Windows | `%APPDATA%\OTWONO AI` | `%APPDATA%\OTWONO\OTWONO AI\data` |
| macOS | `~/Library/Application Support/OTWONO AI` | `~/Library/Application Support/com.OTWONO.OTWONO-AI` |
| Linux | `~/.local/share/otwono-ai` | `~/.local/share/otwonoai` |

This mattered most in `docs/BACKUP.md`: following it meant copying a directory
that does not exist and believing your work was safe. It was wrong in eight
documents and in the source comment they were copied from. A test now pins the
path so a dependency upgrade cannot move your data while the prose keeps
pointing at the old place.

**The installer filenames in `docs/INSTALL.md` were stale.** They still used
the space-separated names that 0.1.1 replaced with dots, so
`sudo dpkg -i otwono-ai_0.1.0_amd64.deb` named a file no release has ever
served. They now match what the release actually publishes.

**The checksum command needed a flag.** `sha256sum -c SHA256SUMS` exits
non-zero over every file in the release you chose not to download. The
documented command is now `sha256sum --ignore-missing -c SHA256SUMS`, which
reports `OK` for what you have and stays quiet about the rest.

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
| Rust, 9 crates | 496 tests |
| Frontend | 25 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 15 |

`./scripts/verify.sh` runs all of it, plus formatting, types and lints.

The 0.1.1 `.deb` was installed and run from the published release: it installs
cleanly, starts, migrates to schema 2, seeds its ten agents, serves `/health`
unauthenticated, refuses `/api` without a token, refuses a hostile `Origin`
even with a valid token, and listens on loopback only. Its published
`SHA256SUMS` verifies against the published files — the fix 0.1.1 existed to
make. The corrected instructions in this release were then run verbatim
against those same files.
