import { chromium } from "playwright-core";
import { chromePath } from "./browser-path.mjs";
const baseUrl = process.env.WORKLIFE_URL || "http://127.0.0.1:4318";
const mobileUrl = `${baseUrl}/?mobile=1`;

await fetch(`${baseUrl}/api/reset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
});
const status = await (await fetch(`${baseUrl}/api/status`)).json();

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(error.message));

try {
  await page.goto(`${mobileUrl}#/home`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "新建计划" }).click();
  await page.getByLabel("计划标题").fill("手机离线同步计划");
  await page.getByLabel("课程或领域").fill("同步验收");
  await page.getByRole("button", { name: "创建计划" }).click();
  await page.getByText("计划已创建").waitFor();

  await page.goto(`${mobileUrl}#/settings`, { waitUntil: "networkidle" });
  await page.getByLabel("电脑同步地址").fill(status.sync.serverUrl);
  await page.getByLabel("电脑端配对码").fill(status.sync.token);
  await page.getByRole("button", { name: "立即同步" }).click();
  await page.getByText("手机与电脑已同步").waitFor();

  let desktopState = (await (await fetch(`${baseUrl}/api/state`)).json()).state;
  const firstSyncFound = desktopState.plans.some(
    (plan) => plan.title === "手机离线同步计划",
  );

  await fetch(`${baseUrl}/api/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      module: "fitness",
      title: "电脑新增计划",
      date: new Date().toISOString().slice(0, 10),
      repeatEnabled: false,
      repeatWeekdays: [],
      startTime: "17:30",
      durationMinutes: 40,
      reminderEnabled: true,
      notes: "",
      details: { focus: "同步验收", exercises: [] },
    }),
  });

  await page.getByRole("button", { name: "立即同步" }).click();
  await page.waitForTimeout(500);
  const mobileState = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("worklife.android.state.v1") || "{}"),
  );
  const bothSidesFound =
    mobileState.plans?.some((plan) => plan.title === "手机离线同步计划") &&
    mobileState.plans?.some((plan) => plan.title === "电脑新增计划");

  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0 && firstSyncFound && bothSidesFound,
        firstSyncFound,
        bothSidesFound,
        errors,
      },
      null,
      2,
    ),
  );

  if (errors.length || !firstSyncFound || !bothSidesFound) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
