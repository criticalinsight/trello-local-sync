// test-gemini-connection.ts
import * as dotenv from 'dotenv';
dotenv.config({ override: true });

async function testConnection() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No API key found in .env');
        process.exit(1);
    }

    const workerUrl = 'https://work.moecapital.com/api/ai/interact';
    console.log(`Testing Interact API at ${workerUrl} with model gemini-2.5-flash...`);

    try {
        const response = await fetch(workerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gemini-2.5-flash',
                input: 'Hello! confirm you are working.'
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log('Interact API Response:', JSON.stringify(data, null, 2));
        console.log('Connection: SUCCESS');
    } catch (error) {
        console.error('Connection: FAILED');
        console.error(error);
    }
}

testConnection();
