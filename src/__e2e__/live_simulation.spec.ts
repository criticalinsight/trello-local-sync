import { test, expect } from '@playwright/test';

test('Full lifecycle simulation on live site', async ({ page }) => {
    // Step 1: Navigate to the live site
    console.log('Navigating to live site...');
    await page.goto('https://work.moecapital.com');
    await expect(page).toHaveTitle(/Local-First Workspace/i);

    // Step 2: Create a new Prompt Board
    console.log('Creating new Prompt Board...');
    await page.click('text=New Prompt Board');
    await page.waitForTimeout(2000); // Wait for initialization

    // Step 3: Add a new draft prompt
    console.log('Adding a new draft prompt...');
    const addBtn = page.getByTitle('Add new prompt');
    await addBtn.click();

    const titleInput = page.locator('input[placeholder="Prompt title..."]');
    await titleInput.fill('Live End-to-End Simulation');
    await titleInput.press('Enter');

    // Step 4: Open the Playground
    console.log('Opening Playground...');
    await page.click('text=Live End-to-End Simulation');

    // Step 5: Fill in the prompt
    console.log('Filling in prompt content...');
    const promptTextarea = page.locator('textarea[placeholder="Enter your prompt here..."]');
    await promptTextarea.fill('Write a short encouraging message for an autonomous AI agent working on complex codebases.');

    // Step 6: Run the Prompt
    console.log('Triggering AI generation...');
    await page.click('text=Run Prompt');

    // Step 7: Observe transitions thru phases
    console.log('Monitoring status transitions...');

    // Wait for 'Generating' status (pulses)
    await expect(page.locator('text=Generating')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'lifecycle-generating.png' });
    console.log('Phase: Generating');

    // Wait for 'Deployed' status
    await expect(page.locator('text=Deployed')).toBeVisible({ timeout: 120000 }); // Longer timeout for AI
    await page.screenshot({ path: 'lifecycle-deployed.png' });
    console.log('Phase: Deployed');

    // Step 8: Final visual check
    const output = page.locator('.prose'); // Markdown output container
    await expect(output).not.toBeEmpty();
    console.log('Simulation complete!');
});
