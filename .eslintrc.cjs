module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'solid'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    env: {
        browser: true,
        es2021: true,
        node: true,
    },
    rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    },
};
