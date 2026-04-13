import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', '__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      'src/**/*.native.test.*',
      'src/components/**',
    ],
  },
});
