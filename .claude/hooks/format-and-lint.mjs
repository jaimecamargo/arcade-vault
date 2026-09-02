#!/usr/bin/env node
// PostToolUse hook: runs Prettier and ESLint on files created/edited by Claude Code.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const IGNORED_DIRS = [".next", "out", "build", "node_modules"];
const ESLINT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx"]);

function readStdin() {
  try {
    const data = readFileSync(0, "utf8");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function bin(name) {
  const exe = process.platform === "win32" ? `${name}.cmd` : name;
  return path.join(PROJECT_ROOT, "node_modules", ".bin", exe);
}

const input = readStdin();
const toolName = input.tool_name;
const filePath = input.tool_input?.file_path;

if (!["Edit", "Write", "MultiEdit"].includes(toolName) || !filePath) {
  process.exit(0);
}

const absPath = path.isAbsolute(filePath)
  ? filePath
  : path.resolve(PROJECT_ROOT, filePath);
const relPath = path.relative(PROJECT_ROOT, absPath);

if (relPath.startsWith("..") || !existsSync(absPath)) {
  process.exit(0);
}

const relSegments = relPath.split(path.sep);
if (relSegments.some((segment) => IGNORED_DIRS.includes(segment))) {
  process.exit(0);
}

const ext = path.extname(absPath);
const messages = [];
let hasUnfixedErrors = false;

const spawnOpts = {
  cwd: PROJECT_ROOT,
  encoding: "utf8",
  shell: process.platform === "win32",
};

// --ignore-unknown makes Prettier silently skip files it has no parser for,
// so this only ever touches files that are actually formatteable.
const prettierResult = spawnSync(
  bin("prettier"),
  ["--write", "--ignore-unknown", absPath],
  spawnOpts,
);
if (prettierResult.error || prettierResult.status !== 0) {
  hasUnfixedErrors = true;
  messages.push(
    `Prettier error on ${relPath}:\n${prettierResult.error?.message || prettierResult.stderr || prettierResult.stdout}`,
  );
}

if (ESLINT_EXTS.has(ext)) {
  const result = spawnSync(bin("eslint"), ["--fix", absPath], spawnOpts);
  if (result.error || result.status !== 0) {
    hasUnfixedErrors = true;
    messages.push(
      `ESLint found issues in ${relPath} that could not be auto-fixed:\n${result.error?.message || result.stdout || result.stderr}`,
    );
  }
}

if (hasUnfixedErrors) {
  console.error(messages.join("\n\n"));
  process.exit(2);
}

process.exit(0);
