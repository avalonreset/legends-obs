# legends-obs - agent instructions

Start with [docs/AGENT-RECIPE.md](docs/AGENT-RECIPE.md) and [README.md](README.md).

## Core Operating Rules

1. **Single Router Skill**: Discovery belongs to `skills/cto-legends/SKILL.md`. Do not register per-module skills or add secondary directories under `skills/`.
2. **CLI Source of Truth**: Resolve the CLI via [docs/AGENT-RECIPE.md](docs/AGENT-RECIPE.md), then run `doctor --pretty`, `manifest --pretty`, and `agent:context --pretty`. In a cloned or extracted release, run `node .\dist\index.js <command>`; a global install also provides `legends-obs` and `lobs`.
3. **Read Before Write**: Run `audit:status`, `audit:diff --against good`, and `status` or `inventory`, then `profile:plan --preset <id>` only after choosing a hardware-appropriate preset. If no ledger exists, capture a baseline first.
4. **Explicit Mutation Gate**: Writes require `LEGENDS_OBS_DRY_RUN=false` and `--confirm`; restore `LEGENDS_OBS_DRY_RUN=true` immediately afterward. Profile writes must be idle, snapshot first, refresh the active video pipeline, and verify readback.
5. **Verified Recording Proof**: A recording is `WORKS` only after `record:canary` verifies FFprobe metadata, dropped frames, and the fresh OBS log. Only a passing canary advances `last-known-good`.

## EDR and Security Guardrails

1. **No Hidden Spawns or Bypass Wrappers**: Never spawn background shells, hidden console windows, or execution-policy bypass shell wrappers, and never ship `.ps1`, `.bat`, or `.cmd` wrapper scripts.
2. **No Browser Profile or Credential Store Probing**: Never read local browser profile databases, DPAPI stores, or system credential stores outside the project workspace and local OBS WebSocket configuration.
3. **Zero Secret Exposure**: Never print, copy, log, or commit the OBS WebSocket password, stream keys, or OBS service tokens to stdout, logs, or Markdown receipts.
4. **Release Hygiene**: Run `python scripts/check_release.py`, `pnpm test`, `pnpm pack:check`, and `pnpm release:check` before packaging.
