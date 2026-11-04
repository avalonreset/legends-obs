import type { JsonObject } from "./types.js";
import type { ObsWebSocketConfig } from "./obs-config.js";
export declare class ObsWebSocketClient {
    private readonly socket;
    private readonly pending;
    private nextRequestId;
    private constructor();
    static connect(host: string, config: ObsWebSocketConfig, timeoutMs?: number): Promise<ObsWebSocketClient>;
    request<T extends JsonObject = JsonObject>(requestType: string, requestData?: JsonObject): Promise<T>;
    close(): Promise<void>;
    private handleMessage;
    private rejectPending;
}
export declare function getOutputActivity(client: ObsWebSocketClient): Promise<JsonObject>;
export declare function assertOutputsIdle(client: ObsWebSocketClient): Promise<JsonObject>;
