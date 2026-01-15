import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
    plugins: [solidPlugin()],
    server: {
        port: 3000,
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            output: {
                manualChunks: {
                    // Vendor chunks
                    'solid-vendor': ['solid-js', 'solid-js/web', 'solid-js/store'],
                    'pglite': ['@electric-sql/pglite'],
                    // Feature chunks
                    'ai-service': ['./src/aiService.ts'],
                    'memory-store': ['./src/memoryStore.ts'],
                },
            },
        },
        chunkSizeWarningLimit: 600, // Increase limit slightly for PGlite
    },
    optimizeDeps: {
        exclude: ['@electric-sql/pglite'],
    },
});
