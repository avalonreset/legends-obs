export declare function validateLocalMediaPath(target: string): Promise<string>;
export declare function assertSafeRegularFile(filePath: string, maxBytes: number, allowedRoot?: string): Promise<string>;
export declare function readSafeJsonFile<T = unknown>(filePath: string, maxBytes?: number, allowedRoot?: string): Promise<T>;
export interface BoundedCommandResult {
    code: number | null;
    stdout: string;
    stderr: string;
    timedOut: boolean;
    overflowed: boolean;
}
export declare function runBoundedCommand(command: string, args: string[], options?: {
    timeoutMs?: number;
    maxBytes?: number;
}): Promise<BoundedCommandResult>;
