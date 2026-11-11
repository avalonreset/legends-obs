import { spawn } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const PROTOCOL_PREFIX_RE = /^[A-Za-z]{2,}[A-Za-z0-9+.-]*:/;
const UNC_PATH_RE = /^(?:\\\\|\/\/)/;

export async function validateLocalMediaPath(target: string): Promise<string> {
  if (typeof target !== "string" || target.trim().length === 0) {
    throw new Error("Media path must be a non-empty string");
  }
  if (target.startsWith("-")) {
    throw new Error(`Refusing option-prefixed media path: ${target}`);
  }
  if (/[\r\n\0]/.test(target)) {
    throw new Error("Refusing media path containing control characters");
  }
  if (PROTOCOL_PREFIX_RE.test(target)) {
    throw new Error(`Refusing URL or protocol media path: ${target}`);
  }
  if (UNC_PATH_RE.test(target)) {
    throw new Error(`Refusing UNC network media path: ${target}`);
  }
  if (!path.isAbsolute(target)) {
    throw new Error(`Media path must be an absolute local path: ${target}`);
  }
  const st = await lstat(target);
  if (st.isSymbolicLink() || !st.isFile()) {
    throw new Error(`Refusing non-regular or symlink media path: ${target}`);
  }
  return target;
}

export async function assertSafeRegularFile(
  filePath: string,
  maxBytes: number,
  allowedRoot?: string,
): Promise<string> {
  if (typeof filePath !== "string" || filePath.trim().length === 0) {
    throw new Error("File path must be a non-empty string");
  }
  const resolvedTarget = path.resolve(filePath);
  if (allowedRoot !== undefined) {
    const resolvedRoot = path.resolve(allowedRoot);
    if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
      throw new Error(`Path escapes allowed directory: ${filePath}`);
    }
  }
  const st = await lstat(resolvedTarget);
  if (st.isSymbolicLink()) {
    throw new Error(`Refusing symbolic link: ${filePath}`);
  }
  if (!st.isFile()) {
    throw new Error(`Refusing non-regular file: ${filePath}`);
  }
  if (st.size > maxBytes) {
    throw new Error(`File exceeds maximum size of ${maxBytes} bytes: ${filePath}`);
  }
  if (allowedRoot !== undefined) {
    const [realTarget, realRoot] = await Promise.all([
      realpath(resolvedTarget),
      realpath(path.resolve(allowedRoot)),
    ]);
    if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
      throw new Error(`Resolved path escapes allowed directory: ${filePath}`);
    }
  }
  return resolvedTarget;
}

export async function readSafeJsonFile<T = unknown>(
  filePath: string,
  maxBytes = 1024 * 1024,
  allowedRoot?: string,
): Promise<T> {
  const safePath = await assertSafeRegularFile(filePath, maxBytes, allowedRoot);
  const raw = await readFile(safePath, "utf8");
  return JSON.parse(raw) as T;
}

export interface BoundedCommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  overflowed: boolean;
}

export async function runBoundedCommand(
  command: string,
  args: string[],
  options?: { timeoutMs?: number; maxBytes?: number },
): Promise<BoundedCommandResult> {
  const timeoutMs = options?.timeoutMs ?? 10_000;
  const maxBytes = options?.maxBytes ?? 1024 * 1024;
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false });
    let stdout = "";
    let stderr = "";
    let totalBytes = 0;
    let timedOut = false;
    let overflowed = false;
    let settled = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    const onChunk = (target: "stdout" | "stderr", chunk: Buffer | string) => {
      const text = String(chunk);
      totalBytes += Buffer.byteLength(text, "utf8");
      if (totalBytes > maxBytes) {
        overflowed = true;
        child.kill();
        return;
      }
      if (target === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout.on("data", (chunk) => onChunk("stdout", chunk));
    child.stderr.on("data", (chunk) => onChunk("stderr", chunk));
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut, overflowed });
    });
  });
}
