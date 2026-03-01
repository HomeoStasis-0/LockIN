import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['client/src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    setupFiles: ['client/src/setupTests.ts'],
  },
})
