/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                board: {
                    bg: '#0f172a',
                    list: '#1e293b',
                    card: '#334155',
                    hover: '#475569',
                },
            },
        },
    },
    plugins: [],
};
