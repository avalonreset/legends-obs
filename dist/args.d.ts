import type { ParsedArgs } from "./types.js";
export declare function parseArgs(argv: string[]): ParsedArgs;
export declare function flagString(args: ParsedArgs, name: string): string | undefined;
export declare function flagNumber(args: ParsedArgs, name: string, fallback: number): number;
export declare function isConfirmed(args: ParsedArgs): boolean;
