import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Main process tests should use node environment
    // Renderer tests will override with jsdom via comments
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // better-sqlite3는 Electron용으로 빌드되어 Node.js 테스트 환경과 호환되지 않음
    // 이 테스트들은 Electron 환경에서만 유의미하므로 제외
    exclude: [
      'node_modules/**',
      'src/main/database/__tests__/schema.test.ts',
      'src/main/database/__tests__/migration.test.ts',
    ],
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
  resolve: {
    alias: {
      // Mock CSS/SCSS modules
      '\\.module\\.(css|scss|sass)$': './__mocks__/styleMock.js',
    },
  },
});
