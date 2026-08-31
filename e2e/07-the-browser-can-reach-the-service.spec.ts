import { expect, test } from '@playwright/test';

import { freshMachine, harnessInfo } from './support/steps';

/**
 * The packaged application is a page at one origin talking to a service at
 * another, so every request is cross-origin and the browser enforces CORS on
 * all of them.
 *
 * Nothing else in this suite covers that. The harness proxies `/api`, which
 * makes those requests same-origin; the Rust tests call handlers directly; and
 * `curl` ignores CORS entirely. So a service that answered every one of those
 * correctly, and answered a browser with a malformed
 * `Access-Control-Allow-Origin`, passed everything — and shipped an
 * application whose every screen was empty, because the browser discarded each
 * response before the interface could read it.
 *
 * These tests go straight to the service from a page, the way the desktop
 * shell does.
 */
test.describe('a browser at another origin', () => {
  test.beforeEach(async () => {
    await freshMachine();
  });

  async function direct(): Promise<{ serviceUrl: string; token: string }> {
    const response = await fetch(`${harnessInfo().url}/__harness/state`, { method: 'POST' });
    return (await response.json()) as { serviceUrl: string; token: string };
  }

  test('can read the API, rather than having the response discarded', async ({ page }) => {
    const { serviceUrl, token } = await direct();
    await page.goto(harnessInfo().url);

    const outcome = await page.evaluate(
      async ([url, bearer]) => {
        try {
          const response = await fetch(`${url}/api/agents`, {
            headers: { Authorization: `Bearer ${bearer}` },
          });
          const body = await response.json();
          const agents = Array.isArray(body) ? body : (body.agents ?? []);
          return { ok: true as const, status: response.status, count: agents.length };
        } catch (error) {
          // A CORS refusal arrives here, as an opaque failure with no status.
          return { ok: false as const, error: String(error) };
        }
      },
      [serviceUrl, token],
    );

    expect(outcome, 'the browser must not be blocked from reading the API').toMatchObject({
      ok: true,
      status: 200,
    });
    expect(outcome.ok && outcome.count, 'the seeded agents must come back').toBeGreaterThan(0);
  });

  test('an error still reaches the interface, instead of vanishing', async ({ page }) => {
    const { serviceUrl } = await direct();
    await page.goto(harnessInfo().url);

    const outcome = await page.evaluate(async (url) => {
      try {
        const response = await fetch(`${url}/api/agents`, {
          headers: { Authorization: 'Bearer not-the-real-token' },
        });
        return { reached: true as const, status: response.status };
      } catch (error) {
        return { reached: false as const, error: String(error) };
      }
    }, serviceUrl);

    // Without CORS headers on the refusal the browser hides it, and the screen
    // shows nothing rather than saying what happened.
    expect(outcome, 'a refusal must be readable, not an opaque network error').toMatchObject({
      reached: true,
      status: 401,
    });
  });
});
