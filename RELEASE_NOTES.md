# OTWONO AI 0.1.4

**No code changed.** Not one line of the application differs from 0.1.3 except
the version string it reports. (The binaries are not byte-identical — these
builds are not reproducible — but the source they were built from is.) There is
no reason to upgrade for behaviour, and nothing is lost by not doing so.

It exists because `STATUS.md` was describing this project more favourably than
the facts support, and that document is now published rather than only sitting
in the repository.

---

## What changed

**`STATUS.md` now separates *built* from *run*.** It used to list the Windows
and macOS packages as "scripted and wired into CI", which undersold what happens
— CI builds and publishes both on every release — while hiding what does not:

| | Built | Installed and run |
|---|---|---|
| Linux `.deb` | Every release, by CI | **Yes** — installed from the published release on a clean machine, driven, and removed |
| WordPress plugin ZIP | Every release, by CI | Tested against a relay that is really listening |
| Windows `.exe` / `.msi` | Every release, by CI | **No. Nobody has launched it.** |
| macOS `.dmg` | Every release, by CI | **No. Nobody has launched it.** |

A build succeeding is not an application starting. If you are on Windows or
macOS, you are the first person to run this, and it would be useful to hear what
happens.

**It also now records that the application has never spoken to a real model
runtime.** Every test drives a stub that speaks the Ollama protocol. That
exercises the wire format, not Ollama or LM Studio themselves, and a real model
is slower, chattier and worse at following orchestration prompts than a stub —
the multi-agent screens are the likeliest place for that to show. The claim
under "What a person can do" now says so rather than reading as though it had
been tried.

The limitation that said those packages "are not built in this environment" is
gone; it stopped being true when the release workflow started building them.

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
- **Nobody has launched the Windows or macOS build.** See above.
- **The application has never spoken to a real Ollama or LM Studio.** See above.
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.** The relay runs and is tested, but no public
  instance exists and nothing in the product points at one.
- **Without an embedding model**, search matches words rather than meaning. The
  interface says so where it matters.

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

The 0.1.3 `.deb` was installed and driven from the published release on a clean
machine: checksums verified, `dpkg -i` clean, `/health` reporting 0.1.3, a
request naming a field the endpoint does not have refused with `422`, the
correct field accepted with `200`, an unknown query parameter refused with
`400`, no token refused with `401`, a hostile `Origin` refused with `403`, and
the service listening on loopback only. That is the same binary this release
ships.
