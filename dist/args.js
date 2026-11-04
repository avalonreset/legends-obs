export function parseArgs(argv) {
    const command = argv[0] ?? "help";
    const flags = {};
    const positionals = [];
    for (let index = 1; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === "-h") {
            flags.help = true;
            continue;
        }
        if (!token.startsWith("--")) {
            positionals.push(token);
            continue;
        }
        const raw = token.slice(2);
        const equals = raw.indexOf("=");
        if (equals >= 0) {
            flags[raw.slice(0, equals)] = raw.slice(equals + 1);
            continue;
        }
        const next = argv[index + 1];
        if (next !== undefined && !next.startsWith("--")) {
            flags[raw] = next;
            index += 1;
        }
        else {
            flags[raw] = true;
        }
    }
    return { command, flags, positionals };
}
export function flagString(args, name) {
    const value = args.flags[name];
    return typeof value === "string" ? value : undefined;
}
export function flagNumber(args, name, fallback) {
    const value = flagString(args, name);
    if (value === undefined)
        return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed))
        throw new Error(`--${name} must be a number`);
    return parsed;
}
export function isConfirmed(args) {
    return args.flags.confirm === true;
}
//# sourceMappingURL=args.js.map