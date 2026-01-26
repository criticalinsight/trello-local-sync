import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './src/__e2e__',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:3001', // Changed port
        trace: 'on-first-retry',
        screenshot: 'on',
        video: 'on',
        headless: true,
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'bun run dev -- --port 3001', // Explicit port
        url: 'http://localhost:3001',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
