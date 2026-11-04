import type { KitConfig } from "./config.js";
import { type ObsWebSocketClient } from "./obs-websocket.js";
import type { JsonObject, ObsPreset } from "./types.js";
type RecordStatusClient = Pick<ObsWebSocketClient, "request">;
export declare function waitForRecordStart(client: RecordStatusClient, timeoutMs?: number, pollMs?: number): Promise<JsonObject>;
export declare function waitForRecordStop(client: RecordStatusClient, timeoutMs?: number, pollMs?: number): Promise<JsonObject>;
export declare function stopRecordingAndVerifyIdle(client: RecordStatusClient, watchMs?: number, pollMs?: number): Promise<void>;
export declare function runCanary(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset, seconds: number, requirePrimaryMicrophone?: boolean): Promise<JsonObject>;
export {};
