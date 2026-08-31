# OTWONO AI 0.1.6

**Windows users: this is the one that actually works.** 0.1.5 claimed to fix the
empty screens and did not. There were two faults in the same handshake, and
0.1.5 fixed only the first — so nothing visibly changed.

---

## What was wrong, both times

The packaged application is a page at one origin talking to a service at
another, so the browser applies CORS to every request. Two things were broken:

**One — the origin was not on the allow-list.** Windows serves the app from
`http://tauri.localhost`, and only the `https://` form was listed. Fixed in
0.1.5.

**Two — the CORS headers were malformed, and mostly absent.** The pre-flight
response named *every* allowed origin in one comma-joined
`Access-Control-Allow-Origin`. That header takes a single origin or `*`; a list
is not a broader permission but an invalid header, and browsers discard the
response. Ordinary responses carried no such header at all.

So with 0.1.5 the first gate opened and the second stayed shut. The service
answered correctly to anything that was not a browser, and the browser threw
every answer away before the interface could read it. Every screen fell back to
its empty state; Settings, which has none, spun.

Both are fixed now. The response names the one origin that asked, and carries
`Vary: Origin` so a cache cannot serve one origin's response to another.

**Refusals carry the headers too.** Previously a `401` was discarded by the
browser like everything else, so a genuine error arrived as an opaque network
failure and the screen simply showed nothing. Now the interface can read the
refusal and tell you what happened.

## Why the tests did not catch it

Every test talked to the service in a way that does not enforce CORS: the Rust
tests call the handlers directly, `curl` ignores it, and the end-to-end harness
proxies `/api` so those requests are same-origin. 500 tests passed on a build
whose every screen was empty in a real browser.

There are now tests that cross an origin in a real browser, against the real
service — the arrangement the desktop shell actually uses. They were confirmed
to fail on the old code before being kept.

## Verifying this download

```bash
sha256sum --ignore-missing -c SHA256SUMS
```

## Please read

- **The installers are unsigned**, and antivirus treats each release as a
  brand-new unknown file. Norton quarantines it on download and again on
  execution; getting past it needs both exclusion lists. A code-signing
  certificate is the only real fix.
- **macOS has still never been launched by anyone.**
- **The application has never spoken to a real model runtime.**
- **Marketplace payments are simulated.** Nothing holds or moves money.
- **No relay is deployed.**

Full detail in `STATUS.md`.

## Verified before release

| | |
|---|---|
| Rust, 9 crates | 502 tests |
| Frontend | 25 |
| WordPress plugin | 28 |
| WordPress against a live relay | 6 |
| End to end, against the real service | 17 — two of them in a browser, cross-origin |
