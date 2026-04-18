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
      // Narrowed: only exclude non-ui components (they import RN modules without mocks).
      // ui/__tests__/* is explicitly re-included above because those primitives mock
      // expo-symbols/expo-image/@react-navigation/native upfront.
      'src/components/!(ui)/**',
    ],
  },
});
