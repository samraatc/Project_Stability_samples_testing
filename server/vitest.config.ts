import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // mongodb-memory-server downloads a mongod binary on first run
    hookTimeout: 120_000,
    testTimeout: 20_000,
    // One suite at a time: several parallel mongod instances exceed
    // their startup timeout on modest machines.
    fileParallelism: false,
  },
});
