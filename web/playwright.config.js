import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    // Use pre-installed Chromium from the cloud container
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Use a plain static server so region-demo.html's importmap vendor paths
  // are served as-is (Vite dev tries to resolve them as Node modules, fails).
  webServer: {
    command: 'python3 -m http.server 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
