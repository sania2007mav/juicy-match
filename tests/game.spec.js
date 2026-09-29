import { expect, test } from "@playwright/test";
import fs from "node:fs";

const shots = "/tmp/sochny-shots";
fs.mkdirSync(shots, { recursive: true });

test("loads the map, plays level 1, and wins", async ({ page }) => {
  await page.goto("/index.html?nosw=1");
  await expect(page.locator("#title")).toHaveText("Сочный ряд");
  await expect(page.locator("[data-level]")).toHaveCount(42);
  const level = page.locator('[data-level="1"]');
  await level.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/map.png` });

  await level.click();
  await expect(page.locator("#btn-start")).toBeVisible();
  await page.locator("#btn-start").click();
  await page.waitForFunction(() => window.__SOCHNY__ && window.__SOCHNY__.isIdle());
  await page.waitForFunction(() => {
    const point = window.__SOCHNY__.cellCenter(0, 0);
    return point.x > 10 && point.y > 10;
  });
  await page.screenshot({ path: `${shots}/level_specials.png` });
  await page.evaluate(() => window.__SOCHNY__.setFast(true));

  for (let turn = 0; turn < 30; turn++) {
    const status = await page.evaluate(() => window.__SOCHNY__.getStatus());
    if (status === "won" || status === "lost") break;
    const hint = await page.evaluate(() => window.__SOCHNY__.getHint());
    expect(hint).toBeTruthy();
    const from = await page.evaluate((move) => window.__SOCHNY__.cellCenter(move.r1, move.c1), hint);
    const to = await page.evaluate((move) => window.__SOCHNY__.cellCenter(move.r2, move.c2), hint);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const status = window.__SOCHNY__.getStatus();
      return window.__SOCHNY__.isIdle() || status === "won" || status === "lost";
    });
  }

  await expect(page.locator('[data-modal="win"]')).toBeVisible();
  await expect(page.locator("#modal-card")).toContainText("Уровень пройден");
  await expect(page.locator(".big-star.on")).toHaveCount(3);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${shots}/win.png` });
});
