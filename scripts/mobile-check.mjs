import { chromium } from "playwright-core";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_URL || "http://127.0.0.1:4318";
const outputDir =
  process.env.WORKLIFE_MOBILE_SHOTS ||
  path.join(os.tmpdir(), "worklife-mobile-check-shots");

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

const mobileUrl = `${baseUrl}/?mobile=1`;
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

try {
  for (const route of routes) {
    await page.goto(`${mobileUrl}#/${route}`, { waitUntil: "networkidle" });
    await page.waitForSelector(".app-shell");
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => ({
      route: window.location.hash,
      bodyWidth: document.body.scrollWidth,
      viewportWidth: window.innerWidth,
      title: document.querySelector(".topbar h1")?.textContent,
      bottomNavVisible:
        getComputedStyle(document.querySelector(".sidebar")).position === "fixed",
      hasError: Boolean(document.querySelector(".app-error")),
    }));
    await page.screenshot({
      path: path.join(outputDir, `${route}.png`),
      fullPage: true,
    });
    results.push(metrics);
  }

  await page.goto(`${mobileUrl}#/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建计划" }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(200);
  await page.screenshot({
    path: path.join(outputDir, "plan-form.png"),
    fullPage: true,
  });
  await page.getByLabel("计划标题").fill("安卓离线测试计划");
  await page.getByRole("button", { name: "创建计划" }).click();
  await page.getByText("计划已创建").waitFor();
  await page.goto(`${mobileUrl}#/today`, { waitUntil: "networkidle" });
  await page.getByText("安卓离线测试计划", { exact: true }).waitFor();

  await page.goto(`${mobileUrl}#/home`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "home-filled.png"),
    fullPage: true,
  });
  await page.goto(`${mobileUrl}#/calendar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(outputDir, "calendar-filled.png"),
    fullPage: true,
  });

  await page.goto(`${mobileUrl}#/settings`, { waitUntil: "networkidle" });
  await page.getByLabel("邮箱").waitFor();
  await page.getByLabel("密码").waitFor();

  const planCreated = await page.evaluate(() => {
    const state = JSON.parse(
      localStorage.getItem("worklife.android.state.v1") || "{}",
    );
    return Array.isArray(state.plans) && state.plans.length === 1;
  });

  console.log(
    JSON.stringify(
      {
        outputDir,
        errors,
        planCreated,
        results,
      },
      null,
      2,
    ),
  );

  if (
    errors.length ||
    !planCreated ||
    results.some(
      (result) =>
        result.hasError ||
        !result.bottomNavVisible ||
        result.bodyWidth > result.viewportWidth + 1,
    )
  ) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
