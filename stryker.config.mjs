/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.app.json',
  mutate: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/test/**',
    '!src/vite-env.d.ts',
    '!src/main.tsx',
  ],
  reporters: ['clear-text', 'progress'],
  thresholds: {
    high: 80,
    low: 60,
    break: 80,
  },
}
