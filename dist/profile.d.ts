import type { KitConfig } from "./config.js";
import { type ObsWebSocketClient } from "./obs-websocket.js";
import type { JsonObject, ObsPreset, ProfileSnapshot } from "./types.js";
export declare function loadPreset(config: KitConfig, id?: string): Promise<ObsPreset>;
export declare function showProfile(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<JsonObject>;
export declare function buildProfilePlan(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<JsonObject>;
export declare function captureProfileSnapshot(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<{
    snapshot: ProfileSnapshot;
    path: string;
}>;
export declare function applyPreset(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<JsonObject>;
export declare function refreshVideoPipeline(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<JsonObject>;
export declare function rollbackSnapshot(client: ObsWebSocketClient, config: KitConfig, snapshotPath: string): Promise<JsonObject>;
export declare function restoreSnapshotVerified(client: ObsWebSocketClient, snapshot: ProfileSnapshot): Promise<void>;
