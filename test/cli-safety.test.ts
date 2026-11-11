import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { parseArgs } from "../src/args.js";
import { resolveConfig } from "../src/config.js";
import { buildManifest } from "../src/manifest.js";
import { isValidPort, readObsWebSocketConfig } from "../src/obs-config.js";
import { normalizeLoopbackHost } from "../src/obs-websocket.js";
import { containsSecretMarker, redactText, redactUnknown } from "../src/redact.js";
import { verifyReceipts, writeReceipt } from "../src/receipts.js";
import { readSafeJsonFile, validateLocalMediaPath } from "../src/safe-io.js";
import { sampleActivePanelFromShell } from "../src/vision-switch.js";

test("argument parser keeps confirmation explicit", () => {
  const parsed = parseArgs(["profile:apply", "--preset", "hdr-4k60-av1-balanced", "--confirm", "--pretty"]);
  assert.equal(parsed.command, "profile:apply");
  assert.equal(parsed.flags.preset, "hdr-4k60-av1-balanced");
  assert.equal(parsed.flags.confirm, true);
  assert.equal(parsed.flags.pretty, true);
});

test("dry-run defaults true and only literal false enables live mode", () => {
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp" }).dryRun, true);
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp", LEGENDS_OBS_DRY_RUN: "false" }).dryRun, false);
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp", LEGENDS_OBS_DRY_RUN: "0" }).dryRun, true);
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp" }).requirePrimaryMicrophone, false);
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp", LEGENDS_OBS_REQUIRE_PRIMARY_MICROPHONE: "true" }).requirePrimaryMicrophone, true);
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp" }).ffprobePath, "ffprobe");
  assert.equal(resolveConfig({ APPDATA: "C:\\Temp", LEGENDS_OBS_FFPROBE_PATH: "C:\\Tools\\ffprobe.exe" }).ffprobePath, "C:\\Tools\\ffprobe.exe");
});

test("redactor removes credential-shaped keys and values", () => {
  const oauthLike = ["ya29", "example"].join(".");
  const redacted = redactUnknown({ server_password: "secret", Token: oauthLike, nested: { cookie: "session", key: "plain-secret" } });
  assert.equal((redacted as Record<string, unknown>).server_password, "[REDACTED]");
  assert.equal((redacted as Record<string, unknown>).Token, "[REDACTED]");
  assert.deepEqual((redacted as Record<string, unknown>).nested, { cookie: "[REDACTED]", key: "[REDACTED]" });
  assert.doesNotMatch(String((redactUnknown("https://example.test/?access_token=private-value"))), /private-value/);
  assert.equal(redactText("log https://user:pass@example.test/path continued"), "log https://%5BREDACTED%5D:%5BREDACTED%5D@example.test/path continued");
  assert.equal(redactText("C:\\Users\\someone\\AppData\\Roaming\\obs-studio"), "%USERPROFILE%\\AppData\\Roaming\\obs-studio");
  const openAiLike = `sk-proj-${"A".repeat(32)}`;
  const slackLike = `xoxb-${"1".repeat(12)}-${"A".repeat(24)}`;
  const slackAppLike = `xapp-${"1".repeat(12)}-${"A".repeat(24)}`;
  const slackEnvelopeLike = `xoxe-${"1".repeat(12)}-${"A".repeat(24)}`;
  assert.equal(redactText(openAiLike), "[REDACTED]");
  assert.equal(redactText(slackLike), "[REDACTED]");
  assert.equal(redactText(slackAppLike), "[REDACTED]");
  assert.equal(redactText(slackEnvelopeLike), "[REDACTED]");
  assert.equal(containsSecretMarker({ key: "plain-secret" }), true);
  assert.equal(containsSecretMarker(openAiLike), true);
  assert.equal(containsSecretMarker(slackLike), true);
  assert.equal(containsSecretMarker(slackAppLike), true);
  assert.equal(containsSecretMarker(slackEnvelopeLike), true);
  assert.equal(containsSecretMarker("log https://example.test/?access_token=private-value continued"), true);
  assert.equal(containsSecretMarker({ safe: "ordinary text" }), false);
});

test("manifest has no ambient MCP, marks every write, and matches CLI/recipe command sets 1:1", async () => {
  const manifest = buildManifest();
  assert.equal(manifest.ambientMcp, false);
  const commands = manifest.commands as Array<{ command: string; mutation: boolean }>;
  for (const name of ["audio:bind", "profile:apply", "profile:refresh", "profile:rollback", "record:start", "record:stop", "record:canary", "vision-switch:tick", "vision-switch:daemon"]) {
    assert.equal(commands.find((command) => command.command === name)?.mutation, true, name);
  }
  const manifestSet = new Set(commands.map((c) => c.command));
  assert.equal(manifestSet.has("logs:latest"), true);

  const indexSource = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
  const recipeSource = await readFile(new URL("../docs/AGENT-RECIPE.md", import.meta.url), "utf8");
  for (const cmd of manifestSet) {
    assert.equal(indexSource.includes(`"${cmd}"`), true, `src/index.ts missing ${cmd}`);
    assert.equal(recipeSource.includes(cmd), true, `docs/AGENT-RECIPE.md missing ${cmd}`);
  }
});

test("validateLocalMediaPath rejects option flags, URLs, protocols, and UNC shares", async () => {
  await assert.rejects(() => validateLocalMediaPath("-print_format"), /option-prefixed/);
  await assert.rejects(() => validateLocalMediaPath("http://127.0.0.1:8080/clip.mp4"), /URL or protocol/);
  await assert.rejects(() => validateLocalMediaPath("concat:a.mp4|b.mp4"), /URL or protocol/);
  await assert.rejects(() => validateLocalMediaPath("\\\\remote-host\\share\\clip.mp4"), /UNC network/);
  await assert.rejects(() => validateLocalMediaPath("relative/clip.mp4"), /absolute local path/);
});

test("loopback host and port validators enforce strict local boundaries", async () => {
  assert.equal(normalizeLoopbackHost("127.0.0.1"), "127.0.0.1");
  assert.equal(normalizeLoopbackHost("::1"), "[::1]");
  assert.equal(normalizeLoopbackHost("[::1]"), "[::1]");
  assert.equal(normalizeLoopbackHost("localhost"), "localhost");
  assert.throws(() => normalizeLoopbackHost("192.168.1.50"), /Refusing non-loopback/);
  assert.throws(() => normalizeLoopbackHost("127.0.0.1:4455/evil#"), /Refusing non-loopback/);

  assert.equal(isValidPort(4455), true);
  assert.equal(isValidPort(0), false);
  assert.equal(isValidPort(70000), false);
  assert.equal(isValidPort(Number.NaN), false);
  assert.equal(isValidPort(4455.5), false);

  const directory = await mkdtemp(path.join(os.tmpdir(), "legends-obs-ws-cfg-"));
  try {
    const badCfg = path.join(directory, "config.json");
    await writeFile(badCfg, JSON.stringify({ server_enabled: true, server_port: 70000, auth_required: true }), "utf8");
    await assert.rejects(() => readObsWebSocketConfig(badCfg), /Invalid OBS WebSocket config/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sampleActivePanelFromShell and readSafeJsonFile enforce extension, size, and containment guards", async () => {
  await assert.rejects(
    () => sampleActivePanelFromShell({ scriptPath: "C:\\Windows\\System32\\cmd.exe" }),
    /Refusing unsupported active panel sensor extension/,
  );
  const directory = await mkdtemp(path.join(os.tmpdir(), "legends-obs-safe-io-"));
  try {
    const inside = path.join(directory, "panel.json");
    await writeFile(inside, JSON.stringify({ panel: "A", process: "code" }), "utf8");
    const sample = await sampleActivePanelFromShell({ scriptPath: inside });
    assert.equal(sample.panel, "A");

    const outside = path.join(os.tmpdir(), `outside-${Date.now()}.json`);
    await writeFile(outside, JSON.stringify({ ok: true }), "utf8");
    try {
      await assert.rejects(
        () => readSafeJsonFile(outside, 1024, directory),
        /escapes allowed directory/,
      );
    } finally {
      await rm(outside, { force: true });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("cursor filter lua defaults Win32 click ripples to false", async () => {
  const lua = await readFile(new URL("../extras/cursor/legends_cursor_filter.lua", import.meta.url), "utf8");
  assert.match(lua, /\benable_left_click\s*=\s*false\b/);
  assert.match(lua, /\benable_right_click\s*=\s*false\b/);
});

test("receipts are redacted and verify clean", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "legends-obs-kit-test-"));
  try {
    const passwordValue = ["do", "not", "store"].join("-");
    const file = await writeReceipt(directory, "test", { password: passwordValue, safe: "yes" });
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, /do-not-store/);
    assert.match(text, /\[REDACTED]/);
    assert.deepEqual(await verifyReceipts(directory), { ok: true, count: 1, failures: [] });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
