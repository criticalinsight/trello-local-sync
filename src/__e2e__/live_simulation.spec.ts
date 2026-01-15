import { test, expect } from '@playwright/test';

test('Full lifecycle simulation on live site', async ({ page }) => {
    // Step 1: Navigate to the live site
    console.log('Navigating to live site...');
    await page.goto('https://work.moecapital.com');
    await expect(page).toHaveTitle('Work');

    // Step 2: Create a new Prompt Board
    console.log('Creating new Prompt Board...');
    await page.click('text=New Prompt Board');
    await page.waitForTimeout(2000); // Wait for initialization

    // Step 3: Add a new draft prompt
    console.log('Adding a new draft prompt...');
    const addBtn = page.getByTitle('Add new prompt');
    await addBtn.click();

    const titleInput = page.locator('input[placeholder="Enter prompt title..."]');

    await titleInput.fill('Live End-to-End Simulation');
    await titleInput.press('Enter');

    // Step 4: Open the Playground
    console.log('Opening Playground...');
    await page.click('text=Live End-to-End Simulation');

    // Step 5: Fill in the prompt
    console.log('Filling in prompt content...');
    const promptTextarea = page.locator('textarea[placeholder="Enter your prompt here..."]');
    await promptTextarea.fill(
        'Write a short encouraging message for an autonomous AI agent working on complex codebases.',
    );

    // Step 6: Run the Prompt
    console.log('Triggering AI generation...');
    await page.click('text=Run Prompt');

    // Step 7: Observe transitions thru phases
    console.log('Monitoring status transitions...');

    // Wait for 'Running' status in the playground button
    const runningBtn = page.locator('button').filter({ hasText: /Running/i });
    await expect(runningBtn).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'lifecycle-running.png' });
    console.log('Phase: Running');

    // Wait for 'Deployed' status in the card badge
    const deployedBadge = page.locator('.bg-emerald-600').filter({ hasText: 'Deployed' });
    await expect(deployedBadge).toBeVisible({ timeout: 180000 }); // 3 mins for deep research if selected
    await page.screenshot({ path: 'lifecycle-deployed.png' });
    console.log('Phase: Deployed');

    // Step 8: Final visual check
    const output = page.locator('.prose'); // Markdown output container
    await expect(output).not.toBeEmpty();
    console.log('Simulation complete!');
});
