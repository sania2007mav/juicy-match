import { expect, test } from "@playwright/test";
import fs from "node:fs";

const shots = "/opt/cursor/artifacts";
fs.mkdirSync(shots, { recursive: true });

async function dragHint(page) {
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

test("loads the map, plays level 1, and wins", async ({ page }) => {
  await page.goto("/index.html?nosw=1");
  await expect(page.locator("#title")).toHaveText("Сочный ряд");
  await expect(page.locator("[data-level]")).toHaveCount(42);
  await page.locator('[data-level="42"]').scrollIntoViewIfNeeded();
  await expect(page.locator(".zone-festival")).toBeVisible();
  await page.screenshot({ path: `${shots}/sochny_map_top.png` });

  await page.locator('[data-level="22"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/sochny_map_citrus.png` });

  const level = page.locator('[data-level="1"]');
  await level.scrollIntoViewIfNeeded();
  await level.click();
  await expect(page.locator("#btn-start")).toBeVisible();
  await page.locator("#btn-start").click();
  await page.waitForFunction(() => window.__SOCHNY__ && window.__SOCHNY__.isIdle());
  await page.waitForFunction(() => {
    const point = window.__SOCHNY__.cellCenter(0, 0);
    return point.x > 10 && point.y > 10;
  });
  await page.screenshot({ path: `${shots}/sochny_level_play.png` });
  await page.evaluate(() => window.__SOCHNY__.setFast(true));

  for (let turn = 0; turn < 30; turn++) {
    const status = await page.evaluate(() => window.__SOCHNY__.getStatus());
    if (status === "won" || status === "lost") break;
    await dragHint(page);
  }

  await expect(page.locator('[data-modal="win"]')).toBeVisible();
  await expect(page.locator("#modal-card")).toContainText("Уровень пройден");
  await expect(page.locator(".big-star.on")).toHaveCount(3);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${shots}/sochny_win_dialog.png` });
});

test("lose dialog offers five free moves", async ({ page }) => {
  await page.goto("/index.html?nosw=1");
  await page.locator('[data-level="1"]').click();
  await page.locator("#btn-start").click();
  await page.waitForFunction(() => window.__SOCHNY__.isIdle());
  const armed = await page.evaluate(() => {
    window.__SOCHNY__.setFast(true);
    return window.__SOCHNY__.prepareLoss();
  });
  expect(armed).toBe(true);
  await dragHint(page);
  await expect(page.locator('[data-modal="lose"]')).toBeVisible();
  await expect(page.locator("#btn-extra")).toBeVisible();
  await expect(page.locator("#modal-card")).toContainText("+5");
  await page.screenshot({ path: `${shots}/sochny_lose_extra.png` });
});
