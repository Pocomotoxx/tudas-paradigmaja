/**
 * Smoke tests for region-demo.html
 * Verifies the game loads, renders the 3D canvas, and core UI is reachable.
 */
import { test, expect } from '@playwright/test';

const DEMO = '/region-demo.html';
const LOAD_TIMEOUT = 15_000;

test.describe('region-demo: page load', () => {
  test('page title contains "Tudás"', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page).toHaveTitle(/Tudás/);
  });

  test('canvas element is visible', async ({ page }) => {
    await page.goto(DEMO);
    const canvas = page.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('loading message disappears after pack loads', async ({ page }) => {
    await page.goto(DEMO);
    // Wait for the canvas to appear (3D scene init)
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
    // The loading overlay should hide (either gone or display:none)
    const loadingMsg = page.locator('#loading-msg');
    await expect(loadingMsg).toBeHidden({ timeout: LOAD_TIMEOUT });
  });
});

test.describe('region-demo: UI panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
  });

  test('turn card shows Kör counter', async ({ page }) => {
    const turnNum = page.locator('#turn-num');
    await expect(turnNum).toBeVisible();
    await expect(turnNum).toHaveText(/\d+/);
  });

  test('gold and KK resources are displayed', async ({ page }) => {
    await expect(page.locator('#res-gold')).toBeVisible();
    await expect(page.locator('#res-kk')).toBeVisible();
  });

  test('End-turn button is present and enabled', async ({ page }) => {
    const btn = page.locator('#btn-end-turn');
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test('diplomacy overlay is hidden at game start', async ({ page }) => {
    const diplo = page.locator('#diplo-overlay');
    await expect(diplo).toBeHidden();
  });

  test('save card is rendered with Save button', async ({ page }) => {
    await expect(page.locator('#save-card')).toBeVisible();
    await expect(page.locator('#btn-save-now')).toBeVisible();
  });
});

test.describe('region-demo: pack selector', () => {
  test('pack selector exists and has options', async ({ page }) => {
    await page.goto(DEMO);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
    const sel = page.locator('#pack-select');
    await expect(sel).toBeVisible();
    const count = await sel.locator('option').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('switching to Hungary pack reloads the map', async ({ page }) => {
    await page.goto(DEMO);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
    const sel = page.locator('#pack-select');
    // Select Hungary if available
    const hungaryOpt = sel.locator('option[value="hungary"]');
    if (await hungaryOpt.count() > 0) {
      await sel.selectOption('hungary');
      // Loading message should briefly appear, then hide
      await expect(page.locator('#loading-msg')).toBeHidden({ timeout: LOAD_TIMEOUT });
      // Turn counter should reset to 1
      await expect(page.locator('#turn-num')).toHaveText('1');
    }
  });
});

test.describe('region-demo: save system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
    // Clear previous saves from localStorage
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) localStorage.removeItem('tudas_save_' + i);
    });
    await page.reload();
    await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
  });

  test('Save button stores a slot and shows status', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    const status = page.locator('#save-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText(/Mentve/);
  });

  test('saved slot appears in slot list', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    await expect(page.locator('#save-slots .slot-row')).toHaveCount(1, { timeout: 3000 });
  });

  test('saved slot can be deleted', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    await page.locator('#save-slots .slot-del').first().click();
    await expect(page.locator('#save-slots .slot-row')).toHaveCount(0, { timeout: 3000 });
  });
});
