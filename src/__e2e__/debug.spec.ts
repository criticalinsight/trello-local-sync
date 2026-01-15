import { test, expect } from '@playwright/test';

test('Debug Home Page Load', async ({ page }) => {
    // Log everything
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
    page.on('pageerror', err => console.log('BROWSER UNCAUGHT ERROR:', err));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText));

    console.log('Navigating to / ...');
    await page.goto('/');

    // Wait a bit
    await page.waitForTimeout(5000);

    // Check body content
    const body = await page.innerHTML('body');
    console.log('BODY CONTENT LENGTH:', body.length);
    if (body.length < 500) console.log('BODY CONTENT:', body);

    // Check for specific element
    const btn = page.getByRole('button', { name: 'New Prompt Board' });
    if (await btn.isVisible()) {
        console.log('Button is visible!');
    } else {
        console.log('Button is NOT visible.');
    }
});
