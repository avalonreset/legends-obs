import type { JsonObject } from "./types.js";
export interface ObsWebSocketConfig {
    server_enabled: boolean;
    server_port: number;
    auth_required: boolean;
    server_password?: string;
}
export declare function readObsWebSocketConfig(file: string): Promise<ObsWebSocketConfig>;
export declare function publicWebSocketConfig(config: ObsWebSocketConfig): JsonObject;
export declare function resolveProfileDirectory(obsConfigRoot: string, profileName: string): Promise<string>;
export declare function readRecordEncoderSettings(obsConfigRoot: string, profileName: string): Promise<JsonObject | null>;
export declare function readProfileIniSettings(obsConfigRoot: string, profileName: string): Promise<JsonObject | null>;
export declare function readGlobalIniSettings(obsConfigRoot: string): Promise<JsonObject | null>;
export declare function latestObsLog(obsConfigRoot: string): Promise<string | null>;
export declare function readDisplayProfilesFromLatestLog(obsConfigRoot: string): Promise<JsonObject[]>;
export declare function readDisplayProfileFromLatestLog(obsConfigRoot: string): Promise<JsonObject | null>;
export declare function readVideoAdaptersFromLatestLog(obsConfigRoot: string): Promise<JsonObject[]>;
export declare function readObsCrashSentinel(obsConfigRoot: string): Promise<JsonObject>;
export declare function readObsCapabilitiesFromLatestLog(obsConfigRoot: string): Promise<JsonObject | null>;
export declare function parseIni(text: string): JsonObject;
export declare function readIniValue(text: string, section: string, key: string): string | undefined;
