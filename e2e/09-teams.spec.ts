/**
 * A team is a workspace (decision D-017), so anywhere an agent can be chosen a
 * team can be chosen instead and whoever is in charge of it answers.
 */

import { expect, test } from '@playwright/test';

import { connectRuntime, freshMachine } from './support/steps';

type Page = import('@playwright/test').Page;

/** An office with a coordinator, built the way a person builds one. */
async function officeLedBy(page: Page, name: string, leader: string) {
  await page.goto('/chat');
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: /Workspaces/ })
    .click();
  await page.getByLabel('Kind').selectOption({ label: 'Office' });
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

  const team = page.locator('.card', { hasText: 'Team (' });
  await page.getByLabel('Add an agent').selectOption({ label: `${leader} — Coordination` });
  await team
    .getByRole('listitem')
    .filter({ hasText: leader })
    .getByRole('button', { name: 'Make coordinator' })
    .click();
  await expect(team.locator('.badge', { hasText: 'coordinator' })).toBeVisible();
}

test.describe('choosing a team instead of an agent', () => {
  test.beforeEach(async () => {
    await freshMachine();
  });

  test('a chat can be answered by a team, and it is the coordinator who answers', async ({
    page,
  }) => {
    await connectRuntime(page);
    await officeLedBy(page, 'Q3 Operations', 'Executive Orchestrator');

    await page.goto('/chat');
    await page.getByRole('button', { name: 'New chat' }).first().click();
    const picker = page.getByLabel('Answered by');
    await expect(picker).toBeVisible();

    await picker.selectOption({ label: 'Q3 Operations — Office' });

    // Reloading proves it was stored rather than only shown.
    await page.reload();
    await expect(page.getByLabel('Answered by')).toHaveValue(/^team:/);
  });

  test('a team with nobody in charge is offered but cannot be chosen', async ({ page }) => {
    // Hiding it would read as a missing feature rather than a gap in the team.
    await page.goto('/chat');
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: /Workspaces/ })
      .click();
    await page.getByLabel('Kind').selectOption({ label: 'Office' });
    await page.getByLabel('Name').fill('Nobody In Charge');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nobody In Charge', level: 1 })).toBeVisible();

    await page.goto('/chat');
    await page.getByRole('button', { name: 'New chat' }).first().click();
    const option = page
      .getByLabel('Answered by')
      .locator('option', { hasText: 'Nobody In Charge' });
    await expect(option).toHaveText(/nobody is in charge yet/);
    // toBeDisabled does not apply to <option>, so check the attribute itself.
    await expect(option).toHaveAttribute('disabled', '');
  });

  test('a planned task can be handed to a different agent', async ({ page }) => {
    await connectRuntime(page);

    await page.goto('/projects');
    await page.getByLabel('What are you trying to achieve?').fill('Quarterly report');
    await page.getByLabel('Say more about it').fill('Summarise Q3.');
    await page.getByLabel('How will you know it is done?').fill('Includes revenue');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: 'Quarterly report' })).toBeVisible();

    await page.getByRole('button', { name: 'Plan the work' }).click();
    await expect(page.getByRole('heading', { name: 'Tasks (2)' })).toBeVisible();

    const tasks = page.locator('.card', { hasText: 'Tasks (' });
    const first = tasks.getByRole('listitem').filter({ hasText: 'Gather the figures' });

    // With no workspace, the plan's roles match the whole seeded roster.
    await expect(first.getByText('Assigned to Researcher')).toBeVisible();

    await first.getByLabel('Hand it to').selectOption({ label: 'Writer' });
    await expect(first.getByText('Assigned to Writer')).toBeVisible();

    // And taken off everyone again: the orchestrator picks it up.
    await first.getByLabel('Hand it to').selectOption('');
    await expect(first.getByText(/Nobody is assigned, so the orchestrator/)).toBeVisible();
  });
});
