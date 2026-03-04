#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

function usage() {
  console.log("Usage: node scripts/switch-env.mjs <source_env_file> [--backup=<backup_file>] [--force]");
}

const args = process.argv.slice(2);
const sourceArg = args.find((arg) => !arg.startsWith("--"));
const backupArg = args.find((arg) => arg.startsWith("--backup="));
const force = args.includes("--force");

if (!sourceArg) {
  usage();
  process.exit(1);
}

const sourcePath = path.resolve(sourceArg);
const targetPath = path.resolve(".env.local");
const webTargetPath = path.resolve("apps/web/.env.local");
const backupPath = path.resolve(backupArg ? backupArg.slice("--backup=".length).trim() : ".env.local.backup");
const webBackupPath = path.resolve("apps/web/.env.local.backup");

if (!fs.existsSync(sourcePath)) {
  console.error(`Source env file not found: ${sourcePath}`);
  process.exit(1);
}

if (!force && sourcePath === targetPath) {
  console.error("Source and target are the same file. Pass --force to continue.");
  process.exit(1);
}

if (fs.existsSync(targetPath)) {
  fs.copyFileSync(targetPath, backupPath);
}

fs.copyFileSync(sourcePath, targetPath);
if (fs.existsSync(webTargetPath)) {
  fs.copyFileSync(webTargetPath, webBackupPath);
}
fs.copyFileSync(sourcePath, webTargetPath);

console.log(
  JSON.stringify(
    {
      message: "Environment switched",
      source: sourcePath,
      target: targetPath,
      webTarget: webTargetPath,
      backup: fs.existsSync(backupPath) ? backupPath : null,
      webBackup: fs.existsSync(webBackupPath) ? webBackupPath : null
    },
    null,
    2
  )
);
