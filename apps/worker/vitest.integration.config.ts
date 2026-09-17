import { defineConfig } from 'vitest/config'

// Runs only against a real database: `pnpm db:test --with-worker` sets VOZIA_TEST_DATABASE_URL.
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int.test.ts'],
    testTimeout: 30_000,
  },
})
