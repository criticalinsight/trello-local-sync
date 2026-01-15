import { test, expect } from '@playwright/test';

test('End-to-end visual simulation on live site', async ({ page }) => {
    // Step 1: Navigate to the live site with cache refresh
    console.log('Navigating to live site...');
    await page.goto('https://work.moecapital.com');
    // Refresh to ensure fresh state/cache
    await page.reload();
    await expect(page).toHaveTitle('Work');

    // Step 2: Create a new Prompt Board
    console.log('Creating new Prompt Board...');
    await page.click('text=New Prompt Board');
    await page.waitForTimeout(3000); // Wait for PGlite initialization

    // Step 3: Add a new draft prompt
    console.log('Adding a new draft prompt...');
    const addBtn = page.getByTitle('Add new prompt');
    await addBtn.click();

    const titleInput = page.locator('input[placeholder="Enter prompt title..."]');
    await titleInput.fill('Visual E2E Test ' + new Date().toLocaleTimeString());
    await titleInput.press('Enter');

    // Step 4: Open the Playground
    console.log('Opening Playground...');
    await page.waitForSelector('.group.bg-slate-800'); // Wait for card to appear
    const lastCard = page.locator('.group.bg-slate-800').last();
    await lastCard.click();

    // Step 5: Fill in the prompt
    console.log('Filling in prompt content...');
    const promptTextarea = page.locator('textarea[placeholder="Enter your prompt here..."]');
    await promptTextarea.fill('Write a 3-sentence vision statement for an AI-first workspace.');

    // Step 6: Run the Prompt
    console.log('Triggering AI generation...');
    await page.click('text=Run Prompt');

    // Step 7: Observe transitions
    console.log('Monitoring status transitions...');

    // 1. Initial Running state in button
    await expect(page.locator('button:has-text("Running...")')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'step1-running.png' });
    console.log('Status: Running (Playground Button)');

    // 2. Refresh/Reload to simulate "refresh cache" while running
    console.log('Simulating cache refresh during generation...');
    await page.reload();

    // 3. Status should persist in card (Generating/Running)
    // Re-open if closed after reload or wait for card status
    await expect(lastCard.locator('text=Generating')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'step2-generating-after-reload.png' });
    console.log('Status: Generating (Card Badge)');

    // 4. Wait for Deployed
    console.log('Waiting for completion...');
    await expect(lastCard.locator('text=Deployed')).toBeVisible({ timeout: 120000 });
    await page.screenshot({ path: 'step3-success-deployed.png' });
    console.log('Status: Deployed (Success)');

    // Final check of output
    await lastCard.click();
    const output = page.locator('.prose');
    await expect(output).not.toBeEmpty();
    await page.screenshot({ path: 'step4-final-output.png' });
    console.log('Simulation complete!');
});
