import { spawn } from "node:child_process";

const baseUrl = "http://127.0.0.1:5173";

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Vite did not start within 15 seconds");
}

export default async function globalSetup() {
  const vite = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    { stdio: "ignore", windowsHide: true },
  );

  await waitForServer();

  return async () => {
    if (vite.exitCode !== null) return;
    if (process.platform === "win32") {
      await new Promise((resolve) => {
        const killer = spawn("taskkill", ["/pid", String(vite.pid), "/t", "/f"], {
          stdio: "ignore",
          windowsHide: true,
        });
        killer.once("close", resolve);
        killer.once("error", resolve);
      });
    } else {
      vite.kill("SIGTERM");
    }
  };
}
