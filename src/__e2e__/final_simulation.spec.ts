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

    console.log('Entering prompt content using type() to trigger onInput...');
    const textarea = page.locator('textarea[placeholder*="Enter your prompt"]');
    await textarea.click();
    await textarea.clear();
    await page.keyboard.type('Write a 2-sentence poem about a coding assistant named Ralph.', { delay: 10 });
    await page.waitForTimeout(500);

    console.log('Clicking Run Prompt...');
    await page.click('button:has-text("Run Prompt")');

    // Monitor Running state in Modal
    console.log('Phase: RUNNING (Checking modal button)');
    const runningStatus = page.locator('button:has-text("Running...")');
    await expect(runningStatus).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: 'final-sim-1-running.png' });

    // Wait for generation to complete by checking card status changes to Deployed
    console.log('Waiting for Deployed status on card...');
    await page.keyboard.press('Escape'); // Close modal to see card status
    const deployedBadge = card.locator('text=Deployed');
    await expect(deployedBadge).toBeVisible({ timeout: 180000 }); // 3 mins for AI generation
    await page.screenshot({ path: 'final-sim-2-deployed.png' });

    console.log('Reopening card to verify output...');
    await card.click();
    const outputPreview = page.locator('.prose');
    await expect(outputPreview).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'final-sim-3-output-ready.png' });

    console.log('Simulation SUCCESSFULLY completed!');
});
