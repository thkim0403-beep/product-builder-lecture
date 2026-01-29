const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  webServer: {
    command: 'npx wrangler pages dev . --port 8787',
    port: 8787,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120 * 1000,
  },
  use: {
    baseURL: 'http://127.0.0.1:8787',
  },
});
