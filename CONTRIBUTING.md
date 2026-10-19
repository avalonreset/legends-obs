# Contributing

## Development checks

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm pack:check
pnpm release:check
```

## Safety rules

Do not commit OBS configuration, credentials, recordings, logs, machine audits, receipts, or `.legends-obs-kit/` state. Live OBS tests must use a disposable profile or a reviewed backup and must leave all outputs stopped.
