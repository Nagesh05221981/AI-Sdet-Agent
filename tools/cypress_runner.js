// tools/cypress_runner.js
// Runs `npx cypress run` as a child process. Streams output live AND
// captures the full stdout + stderr so the self-healing agent can
// reason about failures instead of receiving a one-line "command failed".
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const LOG_PATH = path.resolve("cypress-failure.log");

export function runCypress(specFiles = [], { logPath = LOG_PATH } = {}) {
  return new Promise((resolve) => {
    const parts = ["npx", "cypress", "run"];
    if (Array.isArray(specFiles) && specFiles.length) {
      // Paths come from our generator and are controlled; shell-quote defensively anyway.
      parts.push("--spec", specFiles.map((s) => `"${s}"`).join(","));
    }
    const cmd = parts.join(" ");

    // Pass as a single command string (silences DEP0190 about args+shell).
    const child = spawn(cmd, {
      shell: true,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });

    child.stderr.on("data", (chunk) => {
      const s = chunk.toString();
      stderr += s;
      process.stderr.write(s);
    });

    child.on("close", (code) => {
      const output =
        `# ${cmd}\n` +
        `# exit ${code}\n` +
        `\n===== STDOUT =====\n${stdout}\n` +
        `===== STDERR =====\n${stderr}\n`;

      try {
        fs.writeFileSync(logPath, output);
      } catch (e) {
        // non-fatal: we still return the captured data
      }

      resolve({
        ok: code === 0,
        status: code,
        stdout,
        stderr,
        output,
      });
    });
  });
}
