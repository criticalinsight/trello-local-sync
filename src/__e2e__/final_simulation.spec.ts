import { test, expect } from '@playwright/test';

test('Visual Lifecycle Simulation (Final)', async ({ page }) => {
    const simulationTitle = 'Live E2E ' + Math.floor(Math.random() * 10000);

    console.log('Navigating to live site...');
    await page.goto('https://work.moecapital.com/?t=' + Date.now());
    await expect(page).toHaveTitle(/Work/i);

    console.log('Opening Prompt Board...');
    await page.click('text=New Prompt Board');
    await page.waitForTimeout(3000);

    console.log('Adding draft: ' + simulationTitle);
    await page.getByTitle('Add new prompt').click();
    const titleInput = page.locator('input[placeholder*="title"]');
    await titleInput.fill(simulationTitle);
    await titleInput.press('Enter');

    console.log('Waiting for card to appear...');
    const card = page.locator('.group.bg-slate-800').filter({ hasText: simulationTitle });
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();

    console.log('Entering prompt content...');
    const textarea = page.locator('textarea[placeholder*="Enter your prompt"]');
    await textarea.fill('Write a 2-sentence poem about a coding assistant named Ralph.');

    console.log('Clicking Run Prompt...');
    await page.click('button:has-text("Run Prompt")');

    // Monitor Running state in Modal
    console.log('Phase: RUNNING (Checking modal button)');
    const runningStatus = page.locator('button:has-text("Running...")');
    await expect(runningStatus).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'final-sim-1-running.png' });

    // Wait for output to appear in Modal
    console.log('Waiting for Output content...');
    const outputPreview = page.locator('.prose'); // Markdown container
    await expect(outputPreview).not.toBeEmpty({ timeout: 120000 });
    await page.screenshot({ path: 'final-sim-2-output-ready.png' });

    console.log('Closing modal...');
    await page.keyboard.press('Escape');

    // Verify Card Status on Board
    console.log('Verifying Deployed status on card...');
    const deployedBadge = card.locator('text=Deployed');
    await expect(deployedBadge).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'final-sim-3-deployed-on-board.png' });

    console.log('Simulation SUCCESSFULLY completed!');
});
