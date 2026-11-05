# Operating legends-obs

This is an on-demand module recipe, not a registered skill. The central `cto-legends` router owns discovery.

## Readiness

1. Run `legends-obs doctor --pretty` (or `node .\dist\index.js doctor --pretty` from an extracted release or source checkout). This checks Node 22+, local OBS WebSocket v5 configuration, authenticated loopback control, FFprobe availability, settings ledger status, primary microphone health, recording directory writability, NVENC AV1 capability, and display HDR mode.
2. Inspect the capability map with `legends-obs manifest --pretty` and `legends-obs agent:context --pretty`.
3. Capture or compare the per-machine settings ledger with `legends-obs audit:status --pretty` and `legends-obs audit:diff --against good --pretty` before proposing any profile or audio mutation.
4. All mutating commands default to dry-run (`LEGENDS_OBS_DRY_RUN=true`) and require both `LEGENDS_OBS_DRY_RUN=false` and `--confirm` to execute live. Restore `LEGENDS_OBS_DRY_RUN=true` immediately after any authorized live mutation.

| Goal | Command | Interpretation |
|---|---|---|
| Readiness and capability report | `doctor [--pretty]` | Hard-gates local OBS WebSocket control; reports FFprobe, microphone, NVENC, HDR, and ledger status |
| Machine-readable capability map | `manifest [--pretty]` | Lists every supported command, mutation flag, and safety contract |
| Compact agent operating contract | `agent:context [--pretty]` | Returns operating order, reference preset sequence, and hard invariants |
| Live OBS version and activity | `status [--pretty]` | Reads OBS version, current profile, output activity, recording status, and frame stats |
| Redacted hardware & OBS summary | `inventory [--full] [--pretty]` | Summarizes GPU, encoders, profile, scenes, inputs, and outputs (`--full` for local diagnostics) |
| Primary microphone health | `audio:status [--input NAME] [--include-devices] [--pretty]` | Checks Mic/Aux endpoint availability, mute state, volume, and track routing |
| Preview audio endpoint bind | `audio:plan --device NAME_OR_ID [--input NAME] [--pretty]` | Resolves an exact audio endpoint and previews the binding change |
| Bind audio endpoint | `audio:bind --device NAME_OR_ID [--input NAME] --confirm [--pretty]` | Guarded idle-only audio binding with pre/post audits and readback |
| Check settings ledger pointers | `audit:status [--pretty]` | Offline report of `latest` and `last-known-good` pointers per machine |
| Capture settings baseline | `audit:capture [--reason TEXT] [--pretty]` | Writes an immutable redacted hardware and settings snapshot to `.legends-obs-kit/` |
| Read stored audit surface | `audit:show [--which good\|latest] [--machine KEY] [--pretty]` | Offline inspection of the recorded `good` or `latest` decision surface |
| Compare live OBS against ledger | `audit:diff [--against good\|latest] [--pretty]` | Returns exact JSON drift paths between live OBS and the selected ledger pointer |
| Verify local audit ledger | `audit:verify [--pretty]` | Offline schema, secret-scan, and SHA-256 verification of all local audits |
| Show active profile settings | `profile:show --preset ID [--pretty]` | Reads current OBS profile, video settings, and encoder configuration |
| Preview preset diff | `profile:plan --preset ID [--pretty]` | Computes exact diff between active OBS profile and `--preset <id>` |
| Snapshot active profile | `profile:backup --preset ID [--pretty]` | Writes a redacted rollback snapshot and audit before changes |
| Apply recording preset | `profile:apply --preset ID --confirm [--pretty]` | Transactional idle-only preset apply with snapshot, pipeline refresh, and readback |
| Rebuild OBS video pipeline | `profile:refresh --preset ID --confirm [--pretty]` | Re-applies active video settings to rebuild the OBS pipeline when idle |
| Roll back profile snapshot | `profile:rollback --snapshot PATH --confirm [--pretty]` | Restores a saved profile snapshot with before/after ledger audits |
| Check recording status | `record:status [--pretty]` | Reads current recording state and output activity |
| Start local recording | `record:start [--require-microphone] --confirm [--pretty]` | Starts local recording and verifies encoder initialization |
| Stop local recording | `record:stop --confirm [--pretty]` | Stops active local recording and writes a redacted receipt |
| Run recording canary proof | `record:canary --preset ID [--seconds 3..30] [--require-microphone] --confirm [--pretty]` | Records a short local clip, probes via FFprobe, checks OBS logs/frame drops, and advances `last-known-good` |
| Read filtered OBS log tail | `logs:latest [--pretty]` | Returns redacted recent encoder, recording, and WebSocket lines from the latest OBS log |
| List local operation receipts | `receipts:list [--pretty]` | Lists redacted receipts stored in the state directory |
| Verify local receipts | `receipts:verify [--pretty]` | Validates JSON structure and secret-scans every local receipt |
| Propose AB/CD scene graph | `vision-switch:scene-plan [--current-scene NAME] [--pretty]` | Proposes `panel-ab` / `panel-cd` scene layout and honest-pixel policy |
| Plan or apply scene renames | `vision-switch:scene-apply [--mode plan\|renames-only] [--go NOTE] [--confirm] [--pretty]` | Dry plan by default; live input/scene renames require `--mode renames-only --confirm --go <note>` |
| Inspect Vision Switcher state | `vision-switch:status [--panel A\|B\|C\|D] [--include-window] [--pretty]` | Reports arm/freeze state, panel sample, and current program scene |
| Dry-plan a panel cut | `vision-switch:plan [--panel A\|B\|C\|D] [--current-scene NAME] [--pretty]` | Evaluates panel-to-pair hysteresis and target scene without mutating OBS |
| Arm / disarm / freeze switcher | `vision-switch:arm` / `vision-switch:disarm` / `vision-switch:freeze` / `vision-switch:unfreeze` | Persists switcher control flags in `vision-switch-state.json` |
| Execute one switcher tick | `vision-switch:tick [--panel A\|B\|C\|D] [--confirm] [--pretty]` | Evaluates one sample and cuts scene only when armed, idle, live, and confirmed |
| Run bounded switcher loop | `vision-switch:daemon [--max-ticks N] [--interval-ms MS] [--confirm] [--pretty]` | Polls panel sensor and logs ticks (bounded to 3 ticks unless `--max-ticks` or `--forever` is passed) |

## EDR and Security Guardrails

1. **Zero Hidden Console Spawning or Execution-Policy Bypass Wrappers**: Always invoke the prebuilt CLI via `node .\dist\index.js <command>` or `legends-obs <command>` (`lobs`). Never spawn background shells, hidden console windows, or execution-policy bypass shell wrappers.
2. **Zero Browser Profile or External Credential Store Access**: Never read local browser profile directories, DPAPI stores, or third-party CLI credential stores. Authenticate to OBS strictly in-process through the local OBS WebSocket configuration (`LEGENDS_OBS_WEBSOCKET_CONFIG` or `%APPDATA%\obs-studio\plugin_config\obs-websocket\config.json`).
3. **Zero Secret Exposure**: Never print, copy, log, or commit the OBS WebSocket password, stream keys, or service tokens to stdout, logs, or Markdown receipts.
4. **Controlled State Writes**: Keep all snapshots, audits, and operation receipts inside the local state directory (`LEGENDS_OBS_STATE_DIR` or `%LOCALAPPDATA%\LegendsOBS\state` / `.legends-obs-kit/`). Never run bulk uncontrolled file-overwrite loops or mutate OBS while recording, streaming, replay buffer, or virtual camera outputs are active.
