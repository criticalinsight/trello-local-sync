import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import solid from 'eslint-plugin-solid';
import globals from 'globals';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.worker,
                DurableObjectNamespace: 'readonly',
                Fetcher: 'readonly',
                R2Bucket: 'readonly',
                ScheduledEvent: 'readonly',
                ExecutionContext: 'readonly',
                DurableObjectState: 'readonly',
                WebSocketPair: 'readonly',
                WebSocket: 'readonly',
                ReadableStream: 'readonly',
                WritableStream: 'readonly',
                TransformStream: 'readonly',
                HTMLDivElement: 'readonly',
                HTMLElement: 'readonly',
                DragEvent: 'readonly',
                MouseEvent: 'readonly',
                KeyboardEvent: 'readonly',
                HTMLTextAreaElement: 'readonly',
                HTMLInputElement: 'readonly',
                HTMLSelectElement: 'readonly',
                Document: 'readonly',
                navigator: 'readonly',
                location: 'readonly',
                setInterval: 'readonly',
                clearInterval: 'readonly',
                setTimeout: 'readonly',
                clearTimeout: 'readonly',
                fetch: 'readonly',
                Headers: 'readonly',
                Request: 'readonly',
                Response: 'readonly',
                URL: 'readonly',
                performance: 'readonly',
                crypto: 'readonly',
                confirm: 'readonly',
                alert: 'readonly',
            },
        },
        plugins: {
            solid: solid,
        },
        rules: {
            ...solid.configs.recommended.rules,
            'no-undef': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
            'no-empty': 'warn',
        },
    },
);
