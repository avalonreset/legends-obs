export declare function writeReceipt(stateDir: string, command: string, payload: unknown): Promise<string>;
export declare function writeSnapshot(stateDir: string, profileName: string, payload: unknown): Promise<string>;
export declare function listReceiptFiles(stateDir: string): Promise<string[]>;
export declare function verifyReceipts(stateDir: string): Promise<{
    ok: boolean;
    count: number;
    failures: string[];
}>;
