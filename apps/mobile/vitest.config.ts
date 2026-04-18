import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      '__tests__/**/*.test.ts',
      'src/components/ui/__tests__/**/*.test.ts',
      'src/components/ui/__tests__/**/*.test.tsx',
    ],
    exclude: [
      'node_modules',
      'src/**/*.native.test.*',
      // Narrowed per Phase 19-04: only exclude explicit .native.test.* files
      // inside src/components. Pure helper *.test.ts (e.g., recipeCardStyles,
      // dayRowHelpers) that don't import React Native runtime modules can run
      // under node env and should not be blanket-excluded.
      'src/components/**/*.native.test.*',
    ],
  },
});
