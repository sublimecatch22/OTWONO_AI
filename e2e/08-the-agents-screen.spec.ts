import { expect, test } from '@playwright/test';

import { freshMachine, harnessInfo } from './support/steps';

/**
 * The Agents screen, driven the way a person drives it.
 *
 * The three controls here were changed because someone installed the
 * application and could not use them: a list of templates with a Copy button
 * beside each, a free-text box for the model, and a number labelled
 * "Temperature" that means nothing to anyone setting up an agent.
 */
test.describe('the agents screen', () => {
  test.beforeEach(async ({ page }) => {
    await freshMachine();
    await page.goto(harnessInfo().url);
    await page.getByRole('link', { name: 'Agents' }).click();
  });

  test('an agent is created by choosing a template from the list', async ({ page }) => {
    const picker = page.getByLabel('Template');
    await expect(picker).toBeVisible();

    // Nothing chosen yet: there is nothing to create.
    await expect(page.getByRole('button', { name: 'Create agent' })).toBeDisabled();

    await picker.selectOption({ label: 'Researcher' });

    // Choosing shows what the template is for, before committing to it.
    await expect(page.getByText('Finds and cites evidence', { exact: false })).toBeVisible();

    await page.getByRole('button', { name: 'Create agent' }).click();

    // The new agent is created and opened, ready to edit.
    await expect(page.getByRole('heading', { name: 'Researcher (copy)' })).toBeVisible();
  });

  test('the approach is named, not a number', async ({ page }) => {
    await page.getByLabel('Template').selectOption({ label: 'Designer' });
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page.getByRole('heading', { name: 'Designer (copy)' })).toBeVisible();

    // "Temperature" is gone from the form a person fills in.
    await expect(page.getByLabel('Temperature')).toHaveCount(0);

    const approach = page.getByLabel('Approach');
    await expect(approach).toBeVisible();
    // The Designer template ships at 0.7, which is nearest "Explore alternatives".
    await expect(approach).toHaveValue('explore');

    await approach.selectOption('close');
    await expect(approach).toHaveValue('close');
  });

  test('the model is chosen from what the connection offers', async ({ page }) => {
    await page.getByLabel('Template').selectOption({ label: 'Planner' });
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page.getByRole('heading', { name: 'Planner (copy)' })).toBeVisible();

    const model = page.getByLabel('Model');
    // With no connection chosen there is nothing to choose from, and the form
    // says so rather than offering an empty list.
    await expect(model).toBeDisabled();
    await expect(page.getByText('Choose a connection first.')).toBeVisible();
  });

  test('an agent can be put under an orchestrator, and the list becomes a tree', async ({
    page,
  }) => {
    await page.getByLabel('Template').selectOption({ label: 'Executive Orchestrator' });
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page.getByRole('heading', { name: 'Executive Orchestrator (copy)' })).toBeVisible();

    await page.getByLabel('Template').selectOption({ label: 'Researcher' });
    await page.getByRole('button', { name: 'Create agent' }).click();
    await expect(page.getByRole('heading', { name: 'Researcher (copy)' })).toBeVisible();

    // The machine ships with agents already, so count relative to what is here
    // rather than expecting a particular roster.
    const list = page.locator('ul.tree').first();
    const roots = list.locator('> li');
    const before = await roots.count();
    const orchestrator = roots.filter({ hasText: 'Executive Orchestrator (copy)' });

    // Both are at the top: neither is nested inside anything.
    await expect(roots.filter({ hasText: 'Researcher (copy)' })).toHaveCount(1);
    await expect(orchestrator.locator('ul.tree')).toHaveCount(0);

    const reportsTo = page.getByLabel('Reports to');
    await expect(reportsTo).toHaveValue('');
    // An agent is never offered as its own manager.
    await expect(reportsTo.locator('option', { hasText: 'Researcher (copy)' })).toHaveCount(0);

    await reportsTo.selectOption({ label: 'Executive Orchestrator (copy) — Coordination' });
    await page.getByRole('button', { name: 'Save changes' }).click();
    // Scoped to the toast: the test console's own description contains the
    // word "saved" too, and an unscoped match is ambiguous.
    await expect(page.locator('.toasts').getByText('Saved.', { exact: false })).toBeVisible();

    // One fewer root, and the researcher is now inside the orchestrator.
    await expect(roots).toHaveCount(before - 1);
    await expect(
      orchestrator.locator('ul.tree').getByRole('button', { name: /Researcher \(copy\)/ }),
    ).toBeVisible();
    await expect(orchestrator.getByText('1 report', { exact: false })).toBeVisible();
  });
});
