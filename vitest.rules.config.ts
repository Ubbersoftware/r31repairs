import { defineConfig } from 'vitest/config'

// Separate config for the Firestore security-rules tests. These run against the
// emulator (via `npm run test:rules`, which wraps them in `firebase emulators:exec`),
// not jsdom, and are excluded from the default `npm test`.
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.{test,spec}.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
