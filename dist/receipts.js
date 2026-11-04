import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { containsSecretMarker, redactUnknown } from "./redact.js";
function stamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
}
function safeName(value) {
    return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}
export async function writeReceipt(stateDir, command, payload) {
    const directory = path.join(stateDir, "receipts");
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${stamp()}-${safeName(command)}.json`);
    const redacted = redactUnknown(payload);
    if (containsSecretMarker(redacted))
        throw new Error("Refusing to write receipt containing a secret marker");
    await writeFile(target, `${JSON.stringify(redacted, null, 2)}\n`, "utf8");
    return target;
}
export async function writeSnapshot(stateDir, profileName, payload) {
    const directory = path.join(stateDir, "snapshots");
    await mkdir(directory, { recursive: true });
    const target = path.join(directory, `${stamp()}-${safeName(profileName)}.json`);
    const redacted = redactUnknown(payload);
    if (containsSecretMarker(redacted))
        throw new Error("Refusing to write snapshot containing a secret marker");
    await writeFile(target, `${JSON.stringify(redacted, null, 2)}\n`, "utf8");
    return target;
}
export async function listReceiptFiles(stateDir) {
    const directory = path.join(stateDir, "receipts");
    try {
        return (await readdir(directory)).filter((name) => name.endsWith(".json")).sort().reverse().map((name) => path.join(directory, name));
    }
    catch {
        return [];
    }
}
export async function verifyReceipts(stateDir) {
    const files = await listReceiptFiles(stateDir);
    const failures = [];
    for (const file of files) {
        try {
            const parsed = JSON.parse(await readFile(file, "utf8"));
            if (containsSecretMarker(parsed))
                failures.push(`${file}: secret-like value`);
        }
        catch (error) {
            failures.push(`${file}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return { ok: failures.length === 0, count: files.length, failures };
}
//# sourceMappingURL=receipts.js.map