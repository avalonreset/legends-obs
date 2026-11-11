import crypto from "node:crypto";
import { isValidPort } from "./obs-config.js";
function sha256Base64(value) {
    return crypto.createHash("sha256").update(value).digest("base64");
}
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "[::1]", "localhost"]);
const PRINTABLE_TOKEN_RE = /^[\x21-\x7e]{1,256}$/;
export function normalizeLoopbackHost(host) {
    if (typeof host !== "string") {
        throw new Error("OBS WebSocket host must be a loopback address (127.0.0.1, ::1, or localhost)");
    }
    const trimmed = host.trim().toLowerCase();
    if (!LOOPBACK_HOSTS.has(trimmed)) {
        throw new Error(`Refusing non-loopback OBS WebSocket host: ${host}`);
    }
    return trimmed === "::1" ? "[::1]" : trimmed;
}
export class ObsWebSocketClient {
    socket;
    pending = new Map();
    nextRequestId = 1;
    constructor(socket) {
        this.socket = socket;
    }
    static async connect(host, config, timeoutMs = 5000) {
        if (!config.server_enabled)
            throw new Error("OBS WebSocket server is disabled");
        if (!isValidPort(config.server_port))
            throw new Error(`Invalid OBS WebSocket server_port: ${String(config.server_port)}`);
        if (config.auth_required && !config.server_password)
            throw new Error("OBS WebSocket authentication is enabled but no password is configured");
        const normalizedHost = normalizeLoopbackHost(host);
        const socket = new WebSocket(`ws://${normalizedHost}:${config.server_port}`);
        const client = new ObsWebSocketClient(socket);
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error("Timed out identifying with OBS WebSocket")), timeoutMs);
            const fail = (error) => {
                clearTimeout(timer);
                reject(error);
            };
            socket.onerror = () => fail(new Error(`Could not connect to OBS WebSocket on ${normalizedHost}:${config.server_port}`));
            socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(String(event.data));
                    if (message.op === 0) {
                        const offeredRpcVersion = Number(message.d.rpcVersion);
                        if (!Number.isFinite(offeredRpcVersion) || offeredRpcVersion < 1) {
                            fail(new Error(`OBS WebSocket does not offer supported RPC version 1 (offered ${String(message.d.rpcVersion)})`));
                            socket.close();
                            return;
                        }
                        const identification = { rpcVersion: 1, eventSubscriptions: 0 };
                        const authentication = message.d.authentication;
                        if (authentication && config.auth_required === true && typeof config.server_password === "string" && config.server_password.length > 0) {
                            const salt = typeof authentication.salt === "string" ? authentication.salt : "";
                            const challenge = typeof authentication.challenge === "string" ? authentication.challenge : "";
                            if (!PRINTABLE_TOKEN_RE.test(salt) || !PRINTABLE_TOKEN_RE.test(challenge)) {
                                fail(new Error("OBS WebSocket offered malformed authentication salt or challenge"));
                                socket.close();
                                return;
                            }
                            const secret = sha256Base64(`${config.server_password}${salt}`);
                            identification.authentication = sha256Base64(`${secret}${challenge}`);
                        }
                        socket.send(JSON.stringify({ op: 1, d: identification }));
                        return;
                    }
                    if (message.op === 2) {
                        const negotiatedRpcVersion = Number(message.d.negotiatedRpcVersion);
                        if (negotiatedRpcVersion !== 1) {
                            fail(new Error(`OBS WebSocket negotiated unsupported RPC version ${String(message.d.negotiatedRpcVersion)}`));
                            socket.close();
                            return;
                        }
                        clearTimeout(timer);
                        socket.onerror = () => client.rejectPending(new Error("OBS WebSocket transport error"));
                        socket.onclose = () => client.rejectPending(new Error("OBS WebSocket closed before pending requests completed"));
                        socket.onmessage = (requestEvent) => client.handleMessage(String(requestEvent.data));
                        resolve();
                    }
                }
                catch (error) {
                    fail(error instanceof Error ? error : new Error(String(error)));
                }
            };
        });
        return client;
    }
    async request(requestType, requestData = {}) {
        if (this.socket.readyState !== WebSocket.OPEN)
            throw new Error("OBS WebSocket is not open");
        const requestId = String(this.nextRequestId++);
        return await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(requestId);
                reject(new Error(`${requestType} timed out`));
            }, 8000);
            this.pending.set(requestId, {
                resolve: (value) => resolve(value),
                reject,
                timer,
            });
            this.socket.send(JSON.stringify({ op: 6, d: { requestType, requestId, requestData } }));
        });
    }
    async close() {
        if (this.socket.readyState === WebSocket.CLOSED)
            return;
        await new Promise((resolve) => {
            const timer = setTimeout(resolve, 500);
            this.socket.addEventListener("close", () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
            this.socket.close(1000);
        });
    }
    handleMessage(raw) {
        let message;
        try {
            message = JSON.parse(raw);
        }
        catch {
            return;
        }
        if (message.op !== 7)
            return;
        const requestId = String(message.d.requestId);
        const pending = this.pending.get(requestId);
        if (!pending)
            return;
        this.pending.delete(requestId);
        clearTimeout(pending.timer);
        const status = message.d.requestStatus;
        if (status.result === true) {
            pending.resolve(message.d.responseData ?? {});
        }
        else {
            pending.reject(new Error(`${String(message.d.requestType)} failed (${String(status.code)}): ${String(status.comment ?? "unknown error")}`));
        }
    }
    rejectPending(error) {
        for (const [requestId, pending] of this.pending) {
            this.pending.delete(requestId);
            clearTimeout(pending.timer);
            pending.reject(error);
        }
    }
}
export async function getOutputActivity(client) {
    const status = async (requestType) => {
        try {
            return await client.request(requestType);
        }
        catch (error) {
            // OBS reports disabled/unavailable outputs with 604. An unavailable
            // replay buffer or virtual camera is inactive, not an unsafe mutation.
            if (error instanceof Error && /\(604\):/.test(error.message))
                return { outputActive: false };
            throw error;
        }
    };
    const [record, stream, replay, virtualCamera] = await Promise.all([
        status("GetRecordStatus"),
        status("GetStreamStatus"),
        status("GetReplayBufferStatus"),
        status("GetVirtualCamStatus"),
    ]);
    return {
        recording: record.outputActive === true,
        streaming: stream.outputActive === true,
        replayBuffer: replay.outputActive === true,
        virtualCamera: virtualCamera.outputActive === true,
    };
}
export async function assertOutputsIdle(client) {
    const activity = await getOutputActivity(client);
    const active = Object.entries(activity).filter(([, value]) => value === true).map(([name]) => name);
    if (active.length > 0)
        throw new Error(`Refusing profile mutation while outputs are active: ${active.join(", ")}`);
    return activity;
}
//# sourceMappingURL=obs-websocket.js.map