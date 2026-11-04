import type { KitConfig } from "./config.js";
import type { ObsWebSocketClient } from "./obs-websocket.js";
import type { JsonObject, ObsPreset } from "./types.js";
export declare function collectInventory(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset): Promise<JsonObject>;
