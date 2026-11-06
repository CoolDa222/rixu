import { existsSync } from "node:fs";
import path from "node:path";

const candidates = [
  process.env.CHROME_PATH,
  process.env.PROGRAMFILES
    ? path.join(process.env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe")
    : null,
  process.env["PROGRAMFILES(X86)"]
    ? path.join(
        process.env["PROGRAMFILES(X86)"],
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      )
    : null,
  process.env.LOCALAPPDATA
    ? path.join(
        process.env.LOCALAPPDATA,
        "Google",
        "Chrome",
        "Application",
        "chrome.exe",
      )
    : null,
].filter(Boolean);

export const chromePath = candidates.find((candidate) => existsSync(candidate));

if (!chromePath) {
  throw new Error("Chrome was not found. Set CHROME_PATH before running this check.");
}
