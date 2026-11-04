import { redactUnknown } from "./redact.js";
export function output(value, args) {
    const pretty = args.flags.pretty === true;
    process.stdout.write(`${JSON.stringify(redactUnknown(value), null, pretty ? 2 : 0)}\n`);
}
//# sourceMappingURL=output.js.map