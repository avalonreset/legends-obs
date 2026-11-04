import type { KitConfig } from "./config.js";
import type { ObsWebSocketClient } from "./obs-websocket.js";
import type { JsonObject, ObsPreset } from "./types.js";
export interface AuditCaptureOptions {
    reason: string;
    verification?: {
        receiptPath: string;
        canary: JsonObject;
    };
}
export declare function canonicalJson(value: unknown): string;
export declare function hashJson(value: unknown): string;
export declare function buildMachineKey(machine: JsonObject): string;
export declare function buildDecisionSurface(inventory: JsonObject): JsonObject;
export declare function diffJson(before: unknown, after: unknown, currentPath?: string): JsonObject[];
export declare function persistAuditDocument(stateDir: string, document: JsonObject): Promise<JsonObject>;
export declare function captureAudit(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset, options: AuditCaptureOptions): Promise<JsonObject>;
export declare function readAuditStatus(stateDir: string): Promise<JsonObject>;
export declare function verifyAudits(stateDir: string): Promise<JsonObject>;
export declare function showAudit(stateDir: string, which: "latest" | "good", requestedMachine?: string): Promise<JsonObject>;
export declare function resolveMachinePointer(stateDir: string, machineKey: string, pointerName: string): Promise<JsonObject | null>;
export declare function compareAudit(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset, against: "latest" | "good"): Promise<JsonObject>;
