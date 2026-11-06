import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REG_PATH = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const REG_VALUE = "WorkLifeManager";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");

function runReg(args) {
  return execFileSync("reg.exe", args, {
    windowsHide: true,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

export function isAutoStartEnabled() {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    const output = runReg(["query", REG_PATH, "/v", REG_VALUE]);
    return output.includes(REG_VALUE);
  } catch {
    return false;
  }
}

async function writeStarter(dataDir) {
  const starterPath = path.join(dataDir, "start-background.vbs");
  const serverPath = path.join(appRoot, "server", "index.js");
  const command = `"${process.execPath}" "${serverPath}" --no-open`;
  const content = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.CurrentDirectory = "${appRoot.replaceAll('"', '""')}"`,
    ...(process.versions.electron
      ? [
          'Set processEnv = shell.Environment("PROCESS")',
          'processEnv("ELECTRON_RUN_AS_NODE") = "1"',
        ]
      : []),
    `shell.Run "${command.replaceAll('"', '""')}", 0, False`,
    "",
  ].join("\r\n");

  await fs.mkdir(dataDir, { recursive: true });
  // WScript reads Unicode scripts reliably when the file has a UTF-16 LE BOM.
  // This also preserves non-ASCII project paths.
  await fs.writeFile(starterPath, `\uFEFF${content}`, "utf16le");
  return starterPath;
}

export async function setAutoStart(enabled, dataDir) {
  if (process.platform !== "win32") {
    return { enabled: false, supported: false };
  }

  if (enabled) {
    const starterPath = await writeStarter(dataDir);
    const windowsRoot = process.env.SystemRoot || process.env.WINDIR;
    if (!windowsRoot) {
      throw new Error("Windows system directory was not found.");
    }
    const command = `"${path.join(windowsRoot, "System32", "wscript.exe")}" "${starterPath}"`;
    runReg([
      "add",
      REG_PATH,
      "/v",
      REG_VALUE,
      "/t",
      "REG_SZ",
      "/d",
      command,
      "/f",
    ]);
    return { enabled: true, supported: true, starterPath };
  }

  try {
    runReg(["delete", REG_PATH, "/v", REG_VALUE, "/f"]);
  } catch {
    // The registry value may already be absent.
  }
  return { enabled: false, supported: true };
}
