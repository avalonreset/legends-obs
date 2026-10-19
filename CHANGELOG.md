# Changelog

## 0.1.2 - 2026-10-19

- Renamed the repository, package, CLI, and catalog identity to `legends-obs` (retaining `legends-obs-kit` and `lobs` as CLI/catalog compatibility aliases and preserving existing `.legends-obs-kit/` and `%LOCALAPPDATA%\LegendsOBSKit\state` ledgers).
- Added OBS 32.2+ and 33.0 diagnostics in `doctor`: reports NVENC SDK/driver/CUDA versions (`nvenc-av1`), `sdr_on_hdr_filter` and `hdr_tonemap_filter` availability (`display-hdr-mode`), and unclean-shutdown crash/run sentinel markers (`run_*`, `.sentinel`) when `authenticated-control` fails (ahead of OBS 33.0 disabling WebSocket in Safe Mode).
- Stabilized hardware identity and audit drift: `inventory` falls back to `%SystemRoot%\System32\nvidia-smi.exe` and OBS D3D11 adapter log headers when subshell `PATH` is stripped, `audit` ignores ephemeral `currentSceneTransitionUuid` regeneration across OBS restarts, and `compareAudit` resolves legacy `<host>-<hash12>` pointers seamlessly.
- Refreshed banner and social-preview artwork, README architecture/troubleshooting sections, `CITATION.cff`, `NOTICE`, `THIRD_PARTY_NOTICES.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, and `.github` issue/PR/release templates; re-qualified live 4K60 AV1 10-bit PQ/BT.2020 canary on OBS Studio 32.2.2 / obs-websocket 5.7.4.

## 0.1.1 - 2026-09-25

- Prebuilt release artifact generation: attach the `npm pack` tarball to the GitHub release so catalog installs resolve a verified `artifact_url` with `dist/index.js` plus its runtime needs.

## 0.1.0 - 2026-09-25

- Router-native reset generation: de-skillified to the single registered `cto-legends` router skill (vendored pinned copy at `skills/cto-legends/SKILL.md`, router commit `6975dcb`).
- Removed the per-module skill registration (`skills/legends-obs-kit/`), host shims (`CLAUDE.md`, `CODEX.md`, `GEMINI.md`, `GROK.md`, `LEGENDS.md`), and per-host module installers (`bin/setup-multi-agent.ps1`/`.sh`).
- `package.json` is the authoritative version string; old releases and tags wiped, history preserved.

## 0.4.1

- Adopt the former standalone cursor overlay as optional extra `extras/cursor/` (filter Lua, shader, installer, readme).
- The extra stays GPL-2.0-or-later with its own LICENSE; the kit remains MIT.

## 0.4.0 - 2026-09-04

- Prepared the repository as an MIT-licensed public release candidate with repository metadata, security guidance, contribution guidance, and Windows CI.
- Generalized `doctor`: authenticated OBS control is the hard gate; FFprobe, recording path, microphone, NVENC, HDR, and performance are capability reports.
- Made primary-microphone enforcement opt-in through `--require-microphone` or `LEGENDS_OBS_REQUIRE_PRIMARY_MICROPHONE=true`.
- Required an explicit preset for profile apply/refresh and recording canaries.
- Added valid cross-agent `SKILL.md` frontmatter and current Codex, Claude Code, and Gemini CLI discovery paths.
- Made the Vision Switcher sensor optional/configurable and removed private workstation dependencies from the public core.
- Minimized default inventory, audio, status, and Vision Switcher output; strengthened credential and user-path redaction; and added full-detail opt-ins for local diagnostics.
- Added package allowlisting, private-marker scanning, extracted-tarball smoke tests, and isolated idempotent installer checks.
- Made installed packages self-contained: the CLI, doctor, and multi-agent installer run from `dist` without a source checkout.
- Added multi-display HDR discovery, multi-canvas advisories, stable audit diffs, configurable FFprobe discovery, and stricter WebSocket RPC/transport validation.
- Made profile apply, audio binding, canary cleanup, and scene renames fail closed with verified rollback or explicit recovery uncertainty; added failure-injection regression tests.
- Qualified live control against OBS Studio 32.2.2 / obs-websocket 5.7.4.
- Passed a fresh 4K60 AV1 10-bit PQ/BT.2020 canary with four audio streams, microphone verification, no encoder errors, and no skipped output or render frames.

## 0.3.0 - 2026-07-19

- Added primary-microphone status, repair planning, and guarded endpoint binding.
- Added required doctor and recording gates for endpoint availability, mute, fader, and track routing.
- Added pre/post audio audits, exact readback, rollback receipts, and canary microphone evidence.
- Added a Windows Default binding option after a stale USB endpoint silently disabled a primary microphone.
- Verified real signal on Mic/Aux tracks 1-2 and proved the Zoom reinitializes after an OBS restart.
- Fixed recording-start readback to wait through encoder initialization.
- Fixed canary handling when OBS resets its skipped-frame counter between samples.

## 0.2.0 - 2026-07-18

- Added a hardware-specific, redacted settings and capability audit ledger.
- Added immutable captures plus separate `latest` and canary-qualified `last-known-good` pointers.
- Added exact live drift comparison against either pointer.
- Expanded inventory to profile/global INI settings, installed input/filter/transition kinds and defaults, source filters/audio routing, outputs, modules, and loaded encoders.
- Integrated automatic pre/post profile captures and verified-good canary capture.
- Added ledger health to doctor and strengthened URL/token redaction.

## 0.1.0 - 2026-07-18

- Added authenticated OBS WebSocket v5 CLI spine.
- Added redacted inventory, doctor, manifest, and agent context.
- Added transactional HDR profile plan/backup/apply/refresh/rollback.
- Added guarded recording control and FFprobe/log/frame-drop canary.
- Qualified an RTX 4090 4K60 Rec.2100 PQ AV1 reference path as `WORKS`.
