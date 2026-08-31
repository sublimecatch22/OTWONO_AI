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
});
