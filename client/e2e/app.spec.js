import { test, expect } from "@playwright/test";
test("loads calendar shell and handles navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /watchlist/i })).toBeVisible();
  await page.getByRole("link", { name: "About" }).click();
  await expect(
    page.getByRole("heading", { name: /next thing/i }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Geek Roulette" }).click();
  await expect(
    page.getByRole("heading", { name: /don't know what to watch/i }),
  ).toBeVisible();
});
test("404 route is useful", async ({ page }) => {
  await page.goto("/missing");
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});
