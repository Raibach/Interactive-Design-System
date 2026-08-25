import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// Unit-test environment (jsdom).
//
// The former Storybook browser-test project (storybookTest plugin) was
// removed: it referenced @storybook/addon-vitest — never declared in
// package.json — and .storybook/vitest.setup.ts, which did not exist.
// Browser-mode story tests return as a deliberate Vitest 4 + addon-vitest
// migration; see SPECIFICATIONS.md status map.

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
