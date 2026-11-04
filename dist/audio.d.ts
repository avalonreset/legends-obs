import type { KitConfig } from "./config.js";
import { type ObsWebSocketClient } from "./obs-websocket.js";
import type { JsonObject, ObsPreset } from "./types.js";
interface AudioDeviceItem extends JsonObject {
    itemName: string;
    itemValue: string;
    itemEnabled: boolean;
}
export declare function selectAudioDevice(items: AudioDeviceItem[], query: string): AudioDeviceItem;
export declare function getAudioInputStatus(client: ObsWebSocketClient, inputName: string): Promise<JsonObject>;
export declare function getPrimaryMicrophoneStatus(client: ObsWebSocketClient): Promise<JsonObject>;
export declare function buildAudioBindPlan(client: ObsWebSocketClient, inputName: string, deviceMatch: string): Promise<JsonObject>;
export declare function bindAudioInput(client: ObsWebSocketClient, config: KitConfig, preset: ObsPreset, inputName: string, deviceMatch: string): Promise<JsonObject>;
export {};
