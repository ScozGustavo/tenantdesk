import { existsSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vitest/config'

// tests talk to the real database configured in .env
if (existsSync('.env')) process.loadEnvFile('.env')

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { fileParallelism: false, testTimeout: 20000 },
})
