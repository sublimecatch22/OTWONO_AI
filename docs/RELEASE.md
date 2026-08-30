# Building a release

What a release contains, how each part is built, and what has to happen on
which machine.

---

## What a release folder holds

```
releases/<version>/
  OTWONO AI_<version>_amd64.deb          Linux (built on Linux)
  OTWONO AI_<version>_x64-setup.exe      Windows NSIS (built on Windows)
  OTWONO AI_<version>_x64_en-US.msi      Windows MSI  (built on Windows)
  OTWONO AI_<version>_x64.dmg            macOS (built on macOS)
  otwono-ai-connector.zip                The WordPress plugin (any platform)
  SHA256SUMS                             Checksums for everything above
  RELEASE_NOTES.md                       What changed, and what is known
```

**Desktop installers cannot be cross-built.** Tauri's bundlers use each
platform's own tooling — NSIS and WiX on Windows, `hdiutil` on macOS, `dpkg` on
Linux. This is recorded as decision D-003; the answer is a build job per
platform, not a workaround.

## Before building

```bash
./scripts/verify.sh
```

Runs everything CI runs: formatting, types, lints, the Rust suite, the frontend
suite, the WordPress suite, the WordPress suite against a live relay, and the
end-to-end suite against the real service. **Do not tag a release until this
passes.**

## Linux and macOS

```bash
./scripts/build-release.sh
```

It runs the checks, builds the web assets, packages the plugin, builds the
desktop bundle for the platform it is on, and writes `SHA256SUMS`. If the
desktop bundle fails, it says so and the rest of the folder is still valid.

> **AppImage on a minimal container** fails for want of `xdg-open`. The `.deb`
> is unaffected. Build AppImages on a desktop Linux machine, or install
> `xdg-utils` in the image.

## Windows

On a Windows machine with Node.js 20+ and Rust:

```powershell
pwsh -File scripts/build-windows.ps1
```

It checks its prerequisites first and says what is missing rather than failing
part-way through a long build. Output goes to `releases/windows/` with a
`.sha256` beside each installer.

### Code signing

**The builds are unsigned.** Windows SmartScreen will warn about an unknown
publisher, and users will have to click through it.

To sign, you need a code-signing certificate (an EV certificate builds
SmartScreen reputation immediately; an OV one takes time and downloads).
Tauri's `bundle.windows.certificateThumbprint` setting will sign during the
build. **This needs a certificate the project owner must buy — it is one of the
things listed as outstanding in the handoff.** Nothing here should be signed
with a certificate borrowed from elsewhere.

### macOS notarisation

Same shape: an Apple Developer account, a Developer ID certificate, and
notarisation, or users must right-click → Open on first launch. Also the
owner's to arrange.

## The WordPress plugin

```bash
./scripts/package-wordpress-plugin.sh releases/<version>
```

Builds the ZIP from the plugin directory, excluding tests and development
files, and writes its SHA-256. The plugin has no build step — blocks are
server-rendered — so the ZIP is exactly what runs.

## The GitHub Actions workflow

`.github/workflows/release.yml` can be started two ways, and does the same
thing either way.

**From the Actions tab.** *Actions → Release → Run workflow*, and give it a
version such as `0.1.0`. Nothing has to be tagged first: the release step
creates the tag as it publishes the release, against the commit the run
started from. This is the route to use when you cannot push to `refs/tags/*`.

**By pushing a tag** matching `v*`, if you would rather the tag came first.

| Job | Runner | Produces |
|---|---|---|
| `prepare` | Ubuntu | The version and tag, checked before anything is built. |
| `verify` | Ubuntu | The whole check suite; every build waits on it. |
| `linux` | Ubuntu | The `.deb` and the plugin ZIP. |
| `windows` | Windows | The `.exe` and `.msi`. |
| `macos` | macOS | The `.dmg`. |
| `collect` | Ubuntu | One release folder, `SHA256SUMS`, and a draft GitHub release. |

`prepare` refuses two mistakes before a runner-hour is spent on them: a version
that is not a version, and a version that disagrees with `Cargo.toml`. The
second is the one worth having — it stops a release being labelled `0.2.0`
while every binary inside it reports `0.1.0`.

**The release is published, not drafted.** A draft holds the tag name without
creating the ref, so the tag only exists once someone publishes by hand — and
that step turned out to be an unreliable place to leave a release stranded.
Starting the run is the deliberate act instead: `verify` has to pass before
anything is built, and someone has to press the button.

If you would rather review before it goes public, set `draft: true` on the
release step and publish from the Releases page.

## Version numbers

Nine files state the version, and `prepare` refuses to build unless they all
agree with the version being released — a half-finished bump would otherwise
ship installers reporting the old number under a release named for the new one.

| | |
|---|---|
| `Cargo.toml` | `[workspace.package] version` |
| `apps/desktop/src-tauri/tauri.conf.json` | `version` |
| `package.json` | `version` |
| `apps/desktop/package.json` | `version` |
| `apps/web/package.json` | `version` |
| `packages/ui/package.json` | `version` |
| `wordpress/otwono-ai-connector/otwono-ai-connector.php` | `Version:` header |
| `wordpress/otwono-ai-connector/includes/constants.php` | `VERSION` |
| `wordpress/otwono-ai-connector/readme.txt` | `Stable tag:` |

Regenerate the lockfiles afterwards — `cargo update --workspace` and
`npm install --package-lock-only` — because the workspace crates and packages
are versioned too.

`scripts/build-release.sh` takes the version from `Cargo.toml` and names the
folder after it.

## Release notes

Say what changed, what is known to be limited, and anything a user must do by
hand when upgrading. If a migration runs, say so and say that a backup is taken
first. Do not describe as finished anything that has not been run.

`RELEASE_NOTES.md` **is** the release page: the workflow publishes it as the
body, so whatever it says is what someone sees when they arrive to download.
Write it for that reader, not for someone already in the repository.

## The checklist

- [ ] `./scripts/verify.sh` passes
- [ ] Versions agree in all nine files (`prepare` checks this too, but finding
      out here is cheaper than finding out on a runner)
- [ ] `RELEASE_NOTES.md` written
- [ ] Linux `.deb` built and installed once on a clean machine
- [ ] Windows `.exe` and `.msi` built and installed once
- [ ] macOS `.dmg` built and opened once
- [ ] Plugin ZIP installs into a real WordPress and activates
- [ ] `SHA256SUMS` present and correct
- [ ] An upgrade over an existing data directory keeps its data
- [ ] Known limitations written down rather than left out
