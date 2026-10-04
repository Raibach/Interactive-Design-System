import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Unit-test environment (jsdom).
//
// There is no browser-mode project and no story runner: Storybook was removed from this app
// entirely (2026-10-04) — the tooling, the stories and the configs — so this is the unit
// environment and nothing else.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*', '**/dist/']
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src')
    }
  }
});
