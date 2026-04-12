import { execSync } from "node:child_process";

export function gitInit(cwd: string): void {
  execSync("git init", { cwd, stdio: "pipe" });
}

export function gitCommit(cwd: string, message: string): void {
  execSync("git add .", { cwd, stdio: "pipe" });
  execSync(`git commit -m "${message}"`, { cwd, stdio: "pipe" });
}