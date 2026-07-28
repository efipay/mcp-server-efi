import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'src/index.ts',
        'src/config/**/*.ts',
        'src/server/**/*.ts',
        'src/catalog/index.ts',
        'src/catalog/annotations.ts',
        'src/catalog/types.ts',
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/catalog/descriptions.ts',
        'src/catalog/raw.ts',
        'src/catalog/domains/**',
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,
      },
    },
  },
});
