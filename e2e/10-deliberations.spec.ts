/**
 * A team of agents arguing towards an answer, which is what this application
 * is for. The fake runtime refuses to settle on the first round, so this
 * drives the loop rather than the happy path.
 */

import { expect, test } from '@playwright/test';

import { connectRuntime, freshMachine } from './support/steps';

type Page = import('@playwright/test').Page;

/** The role each shipped agent is listed under in the "Add an agent" picker. */
const ROLES: Record<string, string> = {
  'Executive Orchestrator': 'Coordination',
  'Security Reviewer': 'Security',
};

async function teamOf(page: Page, name: string, agents: string[]) {
  await page.goto('/chat');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Workspaces/ })
    .click();
  await page.getByLabel('Kind').selectOption({ label: 'Boardroom' });
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  const team = page.locator('.card', { hasText: 'Team (' });
  for (const [index, agent] of agents.entries()) {
    await page.getByLabel('Add an agent').selectOption({ label: `${agent} — ${ROLES[agent]}` });
    if (index === 0) {
      await team
        .getByRole('listitem')
        .filter({ hasText: agent })
        .getByRole('button', { name: 'Make coordinator' })
        .click();
    }
  }
  await expect(team.locator('.badge', { hasText: 'coordinator' })).toBeVisible();
}

test.describe('deliberations', () => {
  test.beforeEach(async ({ page }) => {
    await freshMachine();
    await connectRuntime(page);
  });

  test('a team argues over two rounds and the orchestrator stops it', async ({ page }) => {
    await teamOf(page, 'The Board', ['Executive Orchestrator', 'Security Reviewer']);

    await page.getByRole('link', { name: /Deliberations/ }).click();
    await expect(page.getByRole('heading', { name: 'Deliberations', level: 1 })).toBeVisible();

    await page.getByLabel('Team').selectOption({ label: 'The Board — 2 agents' });
    await page.getByLabel('Rounds at most').selectOption('3');
    const question = page.getByLabel('The question');
    await question.fill('Should we ship on Friday?');
    // Assert the typing stuck: a box that silently empties would otherwise
    // show up only as a button that never enables.
    await expect(question).toHaveValue('Should we ship on Friday?');

    await page.getByRole('button', { name: 'Start the deliberation' }).click();

    // The orchestrator refused to settle on round one, so it went round again
    // and settled on round two.
    // The compose card carries the question too, so pick the result card by
    // the thing only it has.
    const card = page.locator('.card').filter({ has: page.locator('.badge', { hasText: 'Settled' }) });
    await expect(card).toHaveCount(1);
    await expect(card.getByText('2 of 3 rounds')).toBeVisible();

    // The answer is there, and so is the argument that produced it: starting a
    // deliberation opens its transcript, so both rounds are on screen already.
    await expect(card.getByText('wait for the audit to close').first()).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Round 1' })).toBeVisible();
    await expect(card.getByRole('heading', { name: 'Round 2' })).toBeVisible();

    // Including what the orchestrator actually said when it sent them back.
    await expect(card.getByText('The cost estimate cites no source').first()).toBeVisible();
    await expect(card.locator('.badge', { hasText: 'Revised position' }).first()).toBeVisible();

    // And it folds away again.
    await card.getByRole('button', { name: 'Hide how they got there' }).click();
    await expect(card.getByRole('heading', { name: 'Round 1' })).toHaveCount(0);
  });

  test('a team too small to argue says so before the button is pressed', async ({ page }) => {
    await teamOf(page, 'Just One', ['Executive Orchestrator']);

    await page.getByRole('link', { name: /Deliberations/ }).click();
    await expect(page.getByRole('heading', { name: 'Deliberations', level: 1 })).toBeVisible();
    await page.getByLabel('Team').selectOption({ label: 'Just One — 1 agent' });
    await page.getByLabel('The question').fill('Anything?');

    await expect(page.getByText('A deliberation needs at least two')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start the deliberation' })).toBeDisabled();
  });
});
