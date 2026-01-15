import { test, expect } from '@playwright/test';

test.describe('AI Prompt Generation Workflow', () => {
    test.setTimeout(60000); // Increase timeout to 60s
    test.beforeEach(async ({ page }) => {
        // Start from home
        await page.goto('/');

        // Wait for New Prompt Board button to be visible
        const newBoardBtn = page.getByRole('button', { name: 'New Prompt Board' });
        await newBoardBtn.waitFor({ state: 'visible', timeout: 30000 });
        await newBoardBtn.click();
        await expect(page.locator('h1')).toContainText('Prompt Engineering Board');
    });

    test('should create a prompt, run it, and verify output', async ({ page }) => {
        // Mock the AI API response (Use broader pattern)
        await page.route('**/*', async (route) => {
            const url = route.request().url();
            if (url.includes('interact')) {
                const json = {
                    id: 'mock-interaction-id',
                    output: { text: 'Hello World from Playwright!\nThis is a mock response.' },
                };
                await route.fulfill({ json });
            } else {
                await route.continue();
            }
        });

        // 1. Create a Draft Prompt
        // Click the + button in the Draft column
        const draftColumn = page.locator('.bg-gradient-to-r.from-slate-600').first().locator('..');
        await draftColumn.getByTitle('Add new prompt').click();

        // Fill input
        await page.locator('input[placeholder="Enter prompt title..."]').fill('Test Hello World');
        await page.getByRole('button', { name: 'Add', exact: true }).click();

        // Verify card created
        const card = page.locator('h3', { hasText: 'Test Hello World' });
        await expect(card).toBeVisible();

        // 2. Add Content (Optional but good for real testing)
        // Click card to open playground
        await card.click();
        const playground = page.locator('.fixed.inset-0');
        await expect(playground).toBeVisible();

        // Fill prompt content area
        await page
            .locator('textarea[placeholder="Enter your prompt here..."]')
            .fill('Write a short hello world poem.');
        // Close playground (assuming clicking outside or close button)
        // 3. Trigger Generation (Run Prompt inside Playground)
        await page.getByRole('button', { name: 'Run Prompt' }).click();

        // 4. Monitor Status Changes & Output
        // Wait for output to appear (it shows "No output yet" initially)
        await expect
            .poll(
                async () => {
                    const preview = page.locator('.prose'); // Markdown container
                    if ((await preview.count()) === 0) return '';
                    return await preview.innerText();
                },
                {
                    timeout: 120000,
                    intervals: [2000],
                },
            )
            .not.toBe('');

        // 5. Verify Output content
        const outputText = await page.locator('.prose').innerText();
        console.log('Generated Output:', outputText);
        expect(outputText.length).toBeGreaterThan(10);

        // Close playground
        // Use the header close button (icon only, but we can target the last button in header)
        // Or send Escape key
        await page.keyboard.press('Escape');

        // Take evidence screenshot
        await page.screenshot({ path: 'ai-generation-complete.png' });
    });
});
