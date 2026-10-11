/**
 * Smoke tests for region-demo.html
 * Verifies the game loads, renders the 3D canvas, and core UI is reachable.
 * Server: python3 -m http.server 5173 (plain static — Vite dev transforms
 * importmap vendor entries as Node modules and fails on them).
 */
import { test, expect } from '@playwright/test';

const DEMO = '/region-demo.html';
const LOAD_TIMEOUT = 20_000;

/** Wait until the loading message is gone (pack fully loaded). */
async function waitForPackLoad(page) {
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: LOAD_TIMEOUT });
  await expect(page.locator('#loading-msg')).toBeHidden({ timeout: LOAD_TIMEOUT });
}

test.describe('region-demo: page load', () => {
  test('page title contains "Tudás"', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page).toHaveTitle(/Tudás/);
  });

  test('canvas element is visible', async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test('loading message disappears after pack loads', async ({ page }) => {
    await page.goto(DEMO);
    await waitForPackLoad(page);
    await expect(page.locator('#loading-msg')).toBeHidden();
  });
});

test.describe('region-demo: UI panels', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await waitForPackLoad(page);
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
    await expect(page.locator('#diplo-overlay')).toBeHidden();
  });

  test('save card is rendered with Save button', async ({ page }) => {
    await expect(page.locator('#save-card')).toBeVisible();
    await expect(page.locator('#btn-save-now')).toBeVisible();
  });
});

test.describe('region-demo: pack selector', () => {
  test('pack selector exists and has options', async ({ page }) => {
    await page.goto(DEMO);
    // pack-select is created dynamically after packs.json loads
    const sel = page.locator('#pack-select');
    await expect(sel).toBeVisible({ timeout: LOAD_TIMEOUT });
    const count = await sel.locator('option').count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('switching to Hungary pack reloads the map', async ({ page }) => {
    await page.goto(DEMO);
    await waitForPackLoad(page);
    const sel = page.locator('#pack-select');
    await expect(sel).toBeVisible({ timeout: LOAD_TIMEOUT });
    const hungaryOpt = sel.locator('option[value="hungary"]');
    if (await hungaryOpt.count() > 0) {
      await sel.selectOption('hungary');
      await expect(page.locator('#loading-msg')).toBeHidden({ timeout: LOAD_TIMEOUT });
      await expect(page.locator('#turn-num')).toHaveText('1');
    }
  });
});

test.describe('region-demo: save system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DEMO);
    await waitForPackLoad(page);
    // Clear previous saves
    await page.evaluate(() => {
      for (let i = 0; i < 5; i++) localStorage.removeItem('tudas_save_' + i);
    });
    // Re-render the (now empty) slot list
    await page.evaluate(() => {
      if (typeof renderSaveSlots === 'function') renderSaveSlots();
    });
  });

  test('Save button stores a slot and shows status', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    await expect(page.locator('#save-status')).toContainText(/Mentve/, { timeout: 5000 });
  });

  test('saved slot appears in slot list', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    await expect(page.locator('#save-slots .slot-row')).toHaveCount(1, { timeout: 5000 });
  });

  test('saved slot can be deleted', async ({ page }) => {
    await page.locator('#btn-save-now').click();
    await expect(page.locator('#save-slots .slot-row')).toHaveCount(1, { timeout: 5000 });
    await page.locator('#save-slots .slot-del').first().click();
    await expect(page.locator('#save-slots .slot-row')).toHaveCount(0, { timeout: 3000 });
  });
});
