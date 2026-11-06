import { chromium } from "playwright-core";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_CLOUD_URL || "https://rixu-app.pages.dev";
const outputDir = path.join(os.tmpdir(), "worklife-guest-shots");
await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  proxy: process.env.WORKLIFE_PROXY
    ? { server: process.env.WORKLIFE_PROXY }
    : undefined,
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().includes("401")) {
    errors.push(message.text());
  }
});
page.on("pageerror", (error) => errors.push(error.message));

const title = `游客计划 ${Date.now()}`;
try {
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.getByRole("button", { name: "不登录，先以游客模式使用" }).click();
  await page.waitForSelector(".app-shell");

  await page.getByRole("button", { name: "新建计划" }).click();
  await page.getByLabel("计划标题").fill(title);
  await page.getByRole("button", { name: "创建计划" }).click();
  await page.getByText("计划已创建").waitFor();

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  const localState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("worklife.android.state.v1") || "{}"),
  );
  const planPersisted = localState.plans?.some((plan) => plan.title === title);

  await page.evaluate(() => {
    window.location.hash = "/settings";
  });
  await page.getByText("浏览器游客模式").waitFor();
  await page.waitForTimeout(320);
  await page.screenshot({
    path: path.join(outputDir, "guest-settings.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "退出游客模式并登录" }).click();
  await page.getByRole("heading", { name: "登录日序" }).waitFor();

  const result = {
    ok: planPersisted && errors.length === 0,
    planPersisted,
    guestDataKeptAfterExit: Boolean(localState.plans?.length),
    errors,
    outputDir,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
