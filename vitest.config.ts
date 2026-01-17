import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Main process tests should use node environment
    // Renderer tests will override with jsdom via comments
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
    // Environment matching per test file
    environmentMatchGlobs: [
      ['src/renderer/**/*.{test,spec}.{ts,tsx}', 'jsdom'],
      ['src/main/**/*.{test,spec}.{ts,tsx}', 'node'],
    ],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
  },
});
