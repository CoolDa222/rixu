import { chromium } from "playwright-core";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_CLOUD_URL || "http://127.0.0.1:8788";
const outputDir = path.join(os.tmpdir(), "worklife-cloud-auth-shots");
await fs.mkdir(outputDir, { recursive: true });

const email = `browser${Date.now()}@example.com`;
const password = `Cloud-${randomBytes(18).toString("base64url")}-Aa1!`;
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

try {
  await page.goto(`${baseUrl}/?cloud=1#/home`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "登录日序" }).waitFor();
  await page.screenshot({
    path: path.join(outputDir, "login.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "还没有账号？创建账号" }).click();
  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "创建账号" }).click();
  await page.waitForSelector(".app-shell");

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".app-shell");
  const sessionPersisted = !(await page.getByRole("heading", { name: "登录日序" }).isVisible());

  await page.evaluate(() => {
    window.location.hash = "/settings";
  });
  await page.locator(".account-summary strong", { hasText: email }).waitFor();
  await page.screenshot({
    path: path.join(outputDir, "account-settings.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "退出登录" }).click();
  await page.getByRole("heading", { name: "登录日序" }).waitFor();

  await page.getByLabel("邮箱").fill(email);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForSelector(".app-shell");

  const result = {
    ok: errors.length === 0 && sessionPersisted,
    email,
    sessionPersisted,
    logoutAndRelogin: true,
    errors,
    outputDir,
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} finally {
  await browser.close();
}
