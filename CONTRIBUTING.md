# Contributing

Contributions are welcome through issues and pull requests.

Before opening a pull request, run:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
corepack pnpm pack:check
corepack pnpm release:check
```

If a global pnpm 11 installation intercepts `corepack pnpm`, pass `--config.pm-on-fail=ignore` or invoke `pnpm` directly so it switches to the pinned `pnpm@10.33.0` release.

Do not commit OBS configuration, credentials, recordings, logs, machine audits, receipts, or `.legends-obs-kit/` state. Live OBS tests must use a disposable profile or a reviewed backup and must leave all outputs stopped.
