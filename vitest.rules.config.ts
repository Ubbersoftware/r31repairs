import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

// Separate config for Firestore emulator tests (security rules + seed scripts).
// These run against the emulator (via `firebase emulators:exec`), not jsdom,
// and are excluded from the default `npm test`.
export default defineConfig({
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.{test,spec}.ts', 'src/scripts/**/*.{test,spec}.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
