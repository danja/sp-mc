import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 10000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    // Run tests sequentially to avoid file system race conditions
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Use mock by default, can be overridden with USE_MOCK_SONIC_PI env var
    env: {
      USE_MOCK_SONIC_PI: process.env.USE_MOCK_SONIC_PI ?? 'true',
    },
  },
});
