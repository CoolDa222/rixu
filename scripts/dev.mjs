import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, "..");
const viteBin = path.join(appRoot, "node_modules", "vite", "bin", "vite.js");
const serverFile = path.join(appRoot, "server", "index.js");

const server = spawn(process.execPath, [serverFile, "--no-open"], {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    WORKLIFE_DATA_DIR:
      process.env.WORKLIFE_DATA_DIR || path.join(appRoot, ".data"),
  },
});

const vite = spawn(process.execPath, [viteBin], {
  cwd: appRoot,
  stdio: "inherit",
});

function stop() {
  server.kill();
  vite.kill();
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  if (code && code !== 0) {
    vite.kill();
  }
});
vite.on("exit", (code) => {
  server.kill();
  process.exitCode = code || 0;
});
