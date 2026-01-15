import { test, expect } from '@playwright/test';

test.describe('Live Site Verification', () => {
    test('should load work.moecapital.com successfully', async ({ page }) => {
        // Navigate to the live site
        const response = await page.goto('https://work.moecapital.com', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Check response status
        console.log('Response status:', response?.status());
        expect(response?.status()).toBe(200);

        // Wait for page to stabilize
        await page.waitForTimeout(2000);

        // Get page title
        const title = await page.title();
        console.log('Page title:', title);

        // Take screenshot
        await page.screenshot({
            path: 'live-site-verification.png',
            fullPage: true
        });

        // Verify key elements exist
        // Check for root div
        const root = page.locator('#root');
        await expect(root).toBeVisible();

        // Log body content for debugging
        const bodyText = await page.locator('body').innerText();
        console.log('Body text (first 500 chars):', bodyText.substring(0, 500));
    });
});
