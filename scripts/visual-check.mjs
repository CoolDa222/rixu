import { chromium } from "playwright-core";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_URL || "http://127.0.0.1:4318";
const outputDir =
  process.env.WORKLIFE_SHOTS ||
  path.join(os.tmpdir(), "worklife-visual-check-shots");

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
const errors = [];

page.on("console", (message) => {
  if (message.type() === "error") {
    errors.push(`console: ${message.text()}`);
  }
});
page.on("pageerror", (error) => errors.push(`page: ${error.message}`));

const routes = [
  "home",
  "today",
  "calendar",
  "learning",
  "fitness",
  "diet",
  "gaming",
  "feedback",
  "settings",
];
const results = [];

for (const route of routes) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  await page.waitForTimeout(320);

  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    pageHeight: document.body.scrollHeight,
    title: document.querySelector(".topbar h1")?.textContent,
    hasError: Boolean(document.querySelector(".app-error")),
  }));

  await page.screenshot({
    path: path.join(outputDir, `${route}.png`),
    fullPage: true,
  });
  results.push({ route, ...metrics });
}

await page.goto(`${baseUrl}/#/home`, { waitUntil: "networkidle" });
await page.waitForTimeout(320);
await page.getByRole("button", { name: "新建计划" }).click();
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(220);
await page.screenshot({
  path: path.join(outputDir, "plan-form.png"),
  fullPage: true,
});
const formVisible = await page.locator('[role="dialog"]').isVisible();

await page.keyboard.press("Escape");
await page.setViewportSize({ width: 1024, height: 900 });
const compactResults = [];
for (const route of ["home", "diet"]) {
  await page.goto(`${baseUrl}/#/${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(320);
  const metrics = await page.evaluate(() => ({
    route: window.location.hash,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    hasError: Boolean(document.querySelector(".app-error")),
  }));
  await page.screenshot({
    path: path.join(outputDir, `compact-${route}.png`),
    fullPage: true,
  });
  compactResults.push(metrics);
}

await browser.close();

console.log(
  JSON.stringify(
    {
      outputDir,
      errors,
      formVisible,
      results,
      compactResults,
    },
    null,
    2,
  ),
);

if (
  errors.length ||
  !formVisible ||
  results.some(
    (result) =>
      result.hasError || result.bodyWidth > result.viewportWidth + 1,
  ) ||
  compactResults.some(
    (result) =>
      result.hasError || result.bodyWidth > result.viewportWidth + 1,
  )
) {
  process.exitCode = 1;
}
