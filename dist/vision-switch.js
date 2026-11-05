/**
 * Legends Vision Switcher - deterministic panel->pair->scene cut planner + daemon.
 * Live SetCurrentProgramScene only when dryRun=false and confirm.
 * Scope: useful desktop applications moving between AB|CD panel pairs.
 * OBS-on-D holds last pair (obs_recursion_guard). Daemon never blocked on OBS self-capture.
 * No LLM in the cut loop. Honest pixels: no OBS stretch default; display-mode changes require explicit operator approval.
 */
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
export const CANONICAL_SCENES = {
    AB: "panel-ab",
    CD: "panel-cd",
};
export const LEGACY_SCENE_ALIASES = {
    "codex left / chrome right": "AB",
    "panel-ab": "AB",
    "panel-cd": "CD",
    "left a / right b": "AB",
    "left c / right d": "CD",
};
export const DEFAULT_ACTIVE_PANEL_SCRIPT = process.env.LEGENDS_OBS_PANEL_SENSOR ||
    process.env.LEGENDS_SHELL_ACTIVE_PANEL ||
    (process.env.LEGENDS_SHELL_KIT_ROOT
        ? path.join(process.env.LEGENDS_SHELL_KIT_ROOT, "scripts", "get-active-panel.mjs")
        : undefined);
export const STATE_FILE_NAME = "vision-switch-state.json";
/**
 * Useful human work surfaces (P0/P1). Process basename match, case-insensitive.
 * Browsers and common desktop applications. Not OBS (self-capture is a non-goal).
 */
export const USEFUL_FOCUS_PROCESSES = [
    "chrome",
    "msedge",
    "msedgewebview2",
    "brave",
    "firefox",
    "opera",
    "vivaldi",
    "chatgpt",
    "codex",
    "code",
    "code - insiders",
    "cursor",
    "devenv",
    "windowsterminal",
    "windows terminal",
    "wt",
    "powershell",
    "pwsh",
    "windowspowershell",
    "slack",
    "discord",
    "notion",
    "figma",
    "obsidian",
    "warp",
    "alacritty",
    "wezterm-gui",
    "hyper",
];
/** Exact OBS process basenames (never substring — "obsidian" must not match). */
export const OBS_FOCUS_PROCESSES = ["obs", "obs64"];
export function processBaseName(processName) {
    if (!processName)
        return "";
    const trimmed = String(processName).trim().replace(/^["']|["']$/g, "");
    const base = path.basename(trimmed).toLowerCase();
    return base.replace(/\.exe$/i, "");
}
export function isObsProcess(processName) {
    const base = processBaseName(processName);
    return OBS_FOCUS_PROCESSES.includes(base);
}
export function isUsefulFocusProcess(processName, title) {
    if (isObsProcess(processName))
        return false;
    const base = processBaseName(processName);
    if (USEFUL_FOCUS_PROCESSES.includes(base))
        return true;
    const t = String(title || "").toLowerCase();
    if (t.includes("chrome") || t.includes("google chrome"))
        return true;
    if (t.includes("chatgpt") || t.includes("codex") || t.includes("cursor"))
        return true;
    return false;
}
/**
 * Classify foreground process for plan/status receipts.
 * obs -> hold last pair on D/CD; useful -> primary cut candidates; other -> geometry still maps.
 */
export function classifyFocusProcess(processName, title) {
    if (isObsProcess(processName))
        return "obs";
    if (isUsefulFocusProcess(processName, title))
        return "useful";
    return "other";
}
/**
 * OBS recursion guard: FG is OBS on panel D (or CD pair geometry).
 * Product must not require OBS self-capture; hold last pair and keep daemon alive.
 */
export function shouldHoldLastPairForObs(sample) {
    if (!isObsProcess(sample.process))
        return false;
    const pair = sample.pair ?? panelToPair(sample.panel);
    return sample.panel === "D" || pair === "CD";
}
export function panelToPair(panel) {
    return panel === "A" || panel === "B" ? "AB" : "CD";
}
export function pairToSceneName(pair) {
    return CANONICAL_SCENES[pair];
}
export function sceneNameToPair(name) {
    const key = String(name || "").trim().toLowerCase();
    if (LEGACY_SCENE_ALIASES[key])
        return LEGACY_SCENE_ALIASES[key];
    if (key.includes("panel-ab") || key === "ab")
        return "AB";
    if (key.includes("panel-cd") || key === "cd")
        return "CD";
    // legacy left/right dual chrome
    if (key.includes("left") && key.includes("right"))
        return "AB";
    return null;
}
export function defaultVisionSwitchState() {
    return {
        armed: false,
        frozen: false,
        lastPanel: null,
        lastPair: null,
        lastScene: null,
        consecutiveNewPair: 0,
        lastCutAt: null,
        lastSampleAt: null,
        debounceMs: 500,
        hysteresisSamples: 2,
        minHoldMs: 1500,
        updatedAt: null,
    };
}
export function stateFilePath(stateDir) {
    return path.join(stateDir, STATE_FILE_NAME);
}
export async function loadVisionSwitchState(stateDir) {
    const file = stateFilePath(stateDir);
    try {
        const raw = JSON.parse(await readFile(file, "utf8"));
        const base = defaultVisionSwitchState();
        return {
            ...base,
            ...raw,
            // hard safety: never trust a corrupted armed=true without explicit field
            armed: raw.armed === true,
            frozen: raw.frozen === true,
            lastPanel: isPanel(raw.lastPanel) ? raw.lastPanel : null,
            lastPair: raw.lastPair === "AB" || raw.lastPair === "CD" ? raw.lastPair : null,
            lastScene: typeof raw.lastScene === "string" ? raw.lastScene : null,
            consecutiveNewPair: Number.isFinite(raw.consecutiveNewPair) ? Number(raw.consecutiveNewPair) : 0,
            lastCutAt: typeof raw.lastCutAt === "string" ? raw.lastCutAt : null,
            lastSampleAt: typeof raw.lastSampleAt === "string" ? raw.lastSampleAt : null,
            debounceMs: Number.isFinite(raw.debounceMs) ? Number(raw.debounceMs) : base.debounceMs,
            hysteresisSamples: Number.isFinite(raw.hysteresisSamples) ? Number(raw.hysteresisSamples) : base.hysteresisSamples,
            minHoldMs: Number.isFinite(raw.minHoldMs) ? Number(raw.minHoldMs) : base.minHoldMs,
            updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
        };
    }
    catch {
        return defaultVisionSwitchState();
    }
}
export async function saveVisionSwitchState(stateDir, state) {
    await mkdir(stateDir, { recursive: true });
    const next = {
        ...state,
        updatedAt: new Date().toISOString(),
    };
    const file = stateFilePath(stateDir);
    await writeFile(file, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    return file;
}
function isPanel(value) {
    return value === "A" || value === "B" || value === "C" || value === "D";
}
/**
 * Pure planner: given sample + state + current OBS scene, decide cut.
 * Hysteresis readiness is caller-supplied (state.consecutiveNewPair already advanced).
 */
export function planVisionCut(input) {
    const { sample, state, currentProgramScene, dryRun } = input;
    const now = input.nowMs ?? Date.now();
    const targetPair = sample.pair || panelToPair(sample.panel);
    const targetScene = pairToSceneName(targetPair);
    const currentPair = currentProgramScene ? sceneNameToPair(currentProgramScene) : state.lastPair;
    const alreadyOnTarget = currentPair === targetPair ||
        (currentProgramScene != null &&
            currentProgramScene.toLowerCase() === targetScene.toLowerCase());
    // Hysteresis is caller-owned: pass hysteresisReady:false to block; omit to allow pure planner cuts.
    const hysteresisReady = input.hysteresisReady !== false;
    const focusClass = classifyFocusProcess(sample.process, sample.title);
    const holdObs = shouldHoldLastPairForObs(sample);
    const heldPair = holdObs ? (state.lastPair ?? currentPair) : null;
    const base = {
        ok: true,
        dryRun,
        sample,
        targetPair,
        targetScene,
        currentScene: currentProgramScene,
        currentPair,
        armed: state.armed,
        frozen: state.frozen,
        hysteresisReady,
        consecutiveNewPair: state.consecutiveNewPair,
        focusClass,
        holdLastPair: false,
        heldPair: null,
        chromeFirst: true,
    };
    if (state.frozen) {
        return {
            ...base,
            wouldCut: false,
            reason: "frozen",
            residual: "vision_switch_frozen",
            frozen: true,
        };
    }
    if (!state.armed) {
        return {
            ...base,
            wouldCut: false,
            reason: "disarmed",
            residual: "vision_switch_disarmed",
            armed: false,
            frozen: false,
        };
    }
    if (alreadyOnTarget) {
        return {
            ...base,
            wouldCut: false,
            reason: "already_on_target_pair",
            residual: null,
            armed: true,
            frozen: false,
        };
    }
    // OBS-on-D/CD holds the last pair. Daemon continues; never require OBS self-capture.
    if (holdObs) {
        return {
            ...base,
            wouldCut: false,
            reason: "hold_last_pair",
            residual: "obs_recursion_guard",
            holdLastPair: true,
            heldPair,
            armed: true,
            frozen: false,
        };
    }
    if (input.outputsActive === true) {
        return {
            ...base,
            wouldCut: false,
            reason: "outputs_active",
            residual: "vision_switch_outputs_active",
            armed: true,
            frozen: false,
        };
    }
    if (state.lastCutAt) {
        const last = Date.parse(state.lastCutAt);
        if (Number.isFinite(last) && now - last < state.minHoldMs) {
            return {
                ...base,
                wouldCut: false,
                reason: "min_hold",
                residual: "vision_switch_min_hold",
                armed: true,
                frozen: false,
            };
        }
    }
    if (!hysteresisReady) {
        return {
            ...base,
            wouldCut: false,
            reason: "hysteresis_pending",
            residual: "vision_switch_hysteresis",
            armed: true,
            frozen: false,
        };
    }
    return {
        ...base,
        wouldCut: true,
        reason: "cut_to_target_pair",
        residual: dryRun ? "dry_run_no_ws_mutation" : null,
        armed: true,
        frozen: false,
    };
}
export function applyHysteresis(state, targetPair) {
    const next = { ...state };
    if (targetPair !== state.lastPair) {
        next.consecutiveNewPair = state.consecutiveNewPair + 1;
    }
    else {
        next.consecutiveNewPair = 0;
    }
    const ready = next.consecutiveNewPair >= state.hysteresisSamples;
    return { state: next, ready };
}
/** After a successful cut (or adopting a pair without cut), lock lastPair. */
export function markCutApplied(state, sample, sceneName, atIso) {
    return {
        ...state,
        lastPanel: sample.panel,
        lastPair: sample.pair,
        lastScene: sceneName,
        consecutiveNewPair: 0,
        lastCutAt: atIso,
        lastSampleAt: atIso,
    };
}
export function markSampleOnly(state, sample, atIso) {
    return {
        ...state,
        lastPanel: sample.panel,
        lastSampleAt: atIso,
    };
}
/** Production options A/B/C allowed; D (stretch) never ships as default. */
export const HONEST_PIXEL_OPTIONS = [
    {
        id: "A_windows_4k_render",
        title: "Windows secondary at 4K render",
        allowed: true,
        isDefault: false,
        requiresExplicitApproval: true,
        summary: "Set the secondary Windows desktop to 3840x2160 so application capture buffers are 4K; place capture-C/D 1:1 in the program without OBS stretching. Confirm hardware capacity before changing display mode.",
    },
    {
        id: "B_native_pillarbox",
        title: "Keep 1440p native + pillarbox/letterbox",
        allowed: true,
        isDefault: true,
        requiresExplicitApproval: false,
        summary: "Secondary stays 2560x1440. Place capture-C/D at true pixel size or integer scale only with black bars in the 4K program. Honest small dual-pane; zero stretch.",
    },
    {
        id: "C_second_4k_monitor",
        title: "Second 4K monitor (hardware)",
        allowed: true,
        isDefault: false,
        requiresExplicitApproval: true,
        summary: "Use two native 4K displays so AB and CD are both captured at native resolution.",
    },
    {
        id: "D_stretch_rejected",
        title: "OBS scale-to-fill / stretch (rejected default)",
        allowed: false,
        isDefault: false,
        requiresExplicitApproval: true,
        summary: "Rejected as the default: stretching a 1440p capture into a 4K program softens the image.",
    },
];
export const DEFAULT_HONEST_PIXEL_OPTION = "B_native_pillarbox";
export function buildHonestPixelPolicy() {
    return {
        defaultOption: DEFAULT_HONEST_PIXEL_OPTION,
        options: HONEST_PIXEL_OPTIONS,
        rejectedDefault: "D_stretch_rejected",
        law: honestPixelPolicySummary(),
    };
}
export function honestPixelPolicySummary() {
    return [
        "Default B: keep secondary at 2560x1440; place CD at 1:1 or integer scale only with black bars (no OBS stretch).",
        "Option A (explicit approval before changing display mode): render the secondary Windows desktop at 4K, then place it 1:1 in the program instead of upscaling in OBS.",
        "Option C later: second 4K monitor.",
        "Rejected default D: OBS scale-to-fill / stretch 1440p into half of 4K.",
        "Primary AB remains native 3840x2160. Do not auto-change Windows display mode.",
    ].join(" ");
}
export function planSceneGraph(currentSceneName) {
    const renames = [];
    if (currentSceneName && currentSceneName !== "panel-ab") {
        renames.push({ from: currentSceneName, to: "panel-ab" });
    }
    const pixelPolicy = buildHonestPixelPolicy();
    return {
        currentScene: currentSceneName,
        proposed: [
            {
                sceneName: "panel-ab",
                pair: "AB",
                leftSource: "capture-A",
                rightSource: "capture-B",
                notes: "Primary 4K dual-pane. Migrate legacy LEFT->capture-A and RIGHT->capture-B. Native 3840x2160 halves; no stretch.",
            },
            {
                sceneName: "panel-cd",
                pair: "CD",
                leftSource: "capture-C",
                rightSource: "capture-D",
                notes: "Applications on C|D (not OBS self-capture). Default placement is 1:1 or integer scale with black bars in 4K. A Windows display-mode change requires explicit operator approval. Reject OBS scale-to-fill stretch.",
            },
        ],
        renameFrom: renames,
        resolutionPolicy: pixelPolicy.law,
        pixelPolicy,
    };
}
/** Parse Shell Get-ActivePanel JSON (or fixture) into a typed sample. */
export function parseActivePanelJson(raw, source = "shell") {
    if (!raw || typeof raw !== "object")
        throw new Error("Active panel sample is not an object");
    const obj = raw;
    const panelRaw = String(obj.panel ?? "").toUpperCase();
    if (!isPanel(panelRaw))
        throw new Error(`Invalid panel in sample: ${String(obj.panel)}`);
    const pairRaw = String(obj.pair ?? panelToPair(panelRaw)).toUpperCase();
    const pair = pairRaw === "CD" ? "CD" : "AB";
    return {
        panel: panelRaw,
        pair,
        process: typeof obj.process === "string" ? obj.process : undefined,
        title: typeof obj.title === "string" ? obj.title : undefined,
        hwnd: typeof obj.hwnd === "number" ? obj.hwnd : typeof obj.hwnd === "string" ? Number(obj.hwnd) : undefined,
        sceneHint: typeof obj.sceneHint === "string" ? obj.sceneHint : pairToSceneName(pair),
        display: typeof obj.display === "string" ? obj.display : undefined,
        confidence: typeof obj.confidence === "string" ? obj.confidence : undefined,
        source,
    };
}
export function sampleFromPanelFlag(panel, extras) {
    const pair = panelToPair(panel);
    return {
        panel,
        pair,
        process: extras?.process,
        title: extras?.title,
        sceneHint: pairToSceneName(pair),
        source: "flag",
    };
}
/**
 * Read active panel JSON from a sensor file or Node/native sensor script.
 * No LLM. Fails closed if sensor is missing or output is unparseable.
 */
export async function sampleActivePanelFromShell(options) {
    const scriptPath = options?.scriptPath ?? DEFAULT_ACTIVE_PANEL_SCRIPT;
    if (!scriptPath) {
        throw new Error("No panel sensor is configured; pass --panel A|B|C|D or set LEGENDS_OBS_PANEL_SENSOR to a JSON file or Node sensor script");
    }
    const timeoutMs = options?.timeoutMs ?? 12000;
    const stdout = scriptPath.toLowerCase().endsWith(".json")
        ? (await readFile(scriptPath, "utf8")).trim()
        : await runSensorJson(scriptPath, timeoutMs);
    let parsed;
    try {
        parsed = JSON.parse(stdout);
    }
    catch {
        const start = stdout.lastIndexOf("{");
        const end = stdout.lastIndexOf("}");
        if (start < 0 || end <= start)
            throw new Error(`Active panel sensor returned non-JSON: ${stdout.slice(0, 200)}`);
        parsed = JSON.parse(stdout.slice(start, end + 1));
    }
    return parseActivePanelJson(parsed, "shell");
}
function runSensorJson(scriptPath, timeoutMs) {
    return new Promise((resolve, reject) => {
        const isNodeScript = /\.(?:mjs|cjs|js)$/i.test(scriptPath);
        const command = isNodeScript ? process.execPath : scriptPath;
        const args = isNodeScript ? [scriptPath] : [];
        const child = spawn(command, args, { shell: false });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill();
            reject(new Error(`Active panel sensor timed out after ${timeoutMs}ms (${scriptPath})`));
        }, timeoutMs);
        child.stdout.on("data", (chunk) => {
            stdout += String(chunk);
        });
        child.stderr.on("data", (chunk) => {
            stderr += String(chunk);
        });
        child.on("error", (error) => {
            clearTimeout(timer);
            reject(error);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error(`Active panel sensor exit ${code}: ${stderr || stdout || "no output"}`));
                return;
            }
            resolve(stdout.trim());
        });
    });
}
/**
 * One poll cycle: sample already obtained → hysteresis → plan → state update (no WS).
 * Caller performs OBS cut when result.cut && authorized and then markCutApplied.
 */
export function evaluateVisionTick(input) {
    const nowMs = input.nowMs ?? Date.now();
    const atIso = new Date(nowMs).toISOString();
    const targetPair = input.sample.pair || panelToPair(input.sample.panel);
    // Track lastPair for hysteresis: if we have never cut, seed from current OBS scene pair
    let state = { ...input.state, lastSampleAt: atIso };
    if (state.lastPair == null && input.currentProgramScene) {
        const fromScene = sceneNameToPair(input.currentProgramScene);
        if (fromScene)
            state = { ...state, lastPair: fromScene };
    }
    const hyst = applyHysteresis(state, targetPair);
    state = hyst.state;
    const plan = planVisionCut({
        sample: input.sample,
        state,
        currentProgramScene: input.currentProgramScene,
        dryRun: input.dryRun || !input.authorized,
        nowMs,
        hysteresisReady: hyst.ready,
        outputsActive: input.outputsActive,
    });
    // If already on target, adopt pair without thrashing consecutive counter forever
    if (plan.reason === "already_on_target_pair") {
        state = {
            ...state,
            lastPanel: input.sample.panel,
            lastPair: targetPair,
            lastScene: input.currentProgramScene ?? state.lastScene,
            consecutiveNewPair: 0,
        };
    }
    else if (plan.holdLastPair || plan.residual === "obs_recursion_guard") {
        // OBS-on-D: hold last pair, clear pair-change hysteresis, keep daemon alive.
        state = markSampleOnly(state, input.sample, atIso);
        state = {
            ...state,
            consecutiveNewPair: 0,
            // preserve lastPair / lastScene — do not adopt CD for OBS self-focus
            lastPair: state.lastPair ?? plan.heldPair ?? null,
        };
    }
    else {
        state = markSampleOnly(state, input.sample, atIso);
        state = { ...state, consecutiveNewPair: hyst.state.consecutiveNewPair };
    }
    const wantCut = plan.wouldCut === true;
    const cut = wantCut && input.authorized && !input.dryRun;
    return {
        ok: true,
        dryRun: input.dryRun || !input.authorized,
        cut,
        authorized: input.authorized,
        sample: input.sample,
        plan,
        state,
        requirement: wantCut && (!input.authorized || input.dryRun)
            ? "Set LEGENDS_OBS_DRY_RUN=false, vision-switch:arm, and pass --confirm for live cuts"
            : undefined,
        note: "Vision Switcher: configured panel sample → plan → optional cut. OBS-on-D holds the last pair. No LLM and no automatic display-mode change.",
    };
}
export function resolveDaemonOptions(input) {
    return {
        intervalMs: Math.max(100, input.intervalMs ?? 500),
        maxTicks: input.maxTicks == null || input.maxTicks <= 0 ? null : Math.floor(input.maxTicks),
        dryRun: input.dryRun,
        authorized: input.authorized && input.dryRun === false,
    };
}
export async function sleepInterval(ms) {
    await wait(ms);
}
export const CANONICAL_SOURCES = {
    A: "capture-A",
    B: "capture-B",
    C: "capture-C",
    D: "capture-D",
};
/** Map observed input names (trim + lower) → panel letter. */
export const LEGACY_SOURCE_ALIASES = {
    left: "A",
    "left a": "A",
    "left-a": "A",
    "capture-a": "A",
    "capture a": "A",
    right: "B",
    "right b": "B",
    "right-b": "B",
    "capture-b": "B",
    "capture b": "B",
    "left c": "C",
    "left-c": "C",
    "capture-c": "C",
    "capture c": "C",
    "right d": "D",
    "right-d": "D",
    "capture-d": "D",
    "capture d": "D",
};
export function normalizeSourceKey(name) {
    return String(name || "").trim().toLowerCase().replace(/\s+/g, " ");
}
export function resolveCanonicalSource(name) {
    const key = normalizeSourceKey(name);
    if (LEGACY_SOURCE_ALIASES[key])
        return LEGACY_SOURCE_ALIASES[key];
    const compact = key.replace(/[\s_-]+/g, "");
    if (compact === "lefta" || compact === "capturea")
        return "A";
    if (compact === "rightb" || compact === "captureb")
        return "B";
    if (compact === "leftc" || compact === "capturec")
        return "C";
    if (compact === "rightd" || compact === "captured")
        return "D";
    return null;
}
function namesFrom(response, key, nameKey) {
    return (response[key] ?? []).map((entry) => String(entry[nameKey] ?? ""));
}
export async function applyRenameStepsTransactional(client, steps) {
    const renames = steps.map((step) => {
        if ((step.action !== "rename_input" && step.action !== "rename_scene") || !step.from || !step.to) {
            throw new Error(`Unsupported auto-apply step: ${step.id}`);
        }
        return { ...step, action: step.action, from: step.from, to: step.to };
    });
    const [beforeInputsResponse, beforeScenesResponse] = await Promise.all([
        client.request("GetInputList"),
        client.request("GetSceneList"),
    ]);
    const beforeInputs = new Set(namesFrom(beforeInputsResponse, "inputs", "inputName"));
    const beforeScenes = new Set(namesFrom(beforeScenesResponse, "scenes", "sceneName"));
    for (const step of renames) {
        const names = step.action === "rename_input" ? beforeInputs : beforeScenes;
        if (!names.has(step.from))
            throw new Error(`Rename source disappeared before apply: ${step.from}`);
        if (names.has(step.to) && step.to !== step.from)
            throw new Error(`Rename target already exists: ${step.to}`);
    }
    const applied = [];
    try {
        for (const step of renames) {
            if (step.action === "rename_input") {
                await client.request("SetInputName", { inputName: step.from, newInputName: step.to });
            }
            else {
                await client.request("SetSceneName", { sceneName: step.from, newSceneName: step.to });
            }
            applied.push({ step: step.id, action: step.action, from: step.from, to: step.to, ok: true });
        }
        const [afterInputsResponse, afterScenesResponse] = await Promise.all([
            client.request("GetInputList"),
            client.request("GetSceneList"),
        ]);
        const afterInputs = new Set(namesFrom(afterInputsResponse, "inputs", "inputName"));
        const afterScenes = new Set(namesFrom(afterScenesResponse, "scenes", "sceneName"));
        for (const step of applied) {
            const names = step.action === "rename_input" ? afterInputs : afterScenes;
            if (!names.has(step.to) || names.has(step.from))
                throw new Error(`Rename readback failed: ${step.from} -> ${step.to}`);
        }
        return applied.map(({ action: _action, ...entry }) => entry);
    }
    catch (error) {
        const rollbackFailures = [];
        const recovery = new Map(applied.map((step) => [step.step, step]));
        try {
            const [inputsResponse, scenesResponse] = await Promise.all([
                client.request("GetInputList"),
                client.request("GetSceneList"),
            ]);
            const inputs = new Set(namesFrom(inputsResponse, "inputs", "inputName"));
            const scenes = new Set(namesFrom(scenesResponse, "scenes", "sceneName"));
            for (const step of renames) {
                const names = step.action === "rename_input" ? inputs : scenes;
                if (names.has(step.to) && !names.has(step.from)) {
                    recovery.set(step.id, { step: step.id, action: step.action, from: step.from, to: step.to, ok: true });
                }
            }
        }
        catch (detectionError) {
            rollbackFailures.push(`post-failure state detection: ${detectionError instanceof Error ? detectionError.message : String(detectionError)}`);
        }
        const rollbackRequestErrors = new Map();
        for (const step of [...recovery.values()].reverse()) {
            try {
                if (step.action === "rename_input") {
                    await client.request("SetInputName", { inputName: step.to, newInputName: step.from });
                }
                else {
                    await client.request("SetSceneName", { sceneName: step.to, newSceneName: step.from });
                }
            }
            catch (rollbackError) {
                rollbackRequestErrors.set(step.step, rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
            }
        }
        try {
            const [inputsResponse, scenesResponse] = await Promise.all([
                client.request("GetInputList"),
                client.request("GetSceneList"),
            ]);
            const inputs = new Set(namesFrom(inputsResponse, "inputs", "inputName"));
            const scenes = new Set(namesFrom(scenesResponse, "scenes", "sceneName"));
            for (const step of recovery.values()) {
                const names = step.action === "rename_input" ? inputs : scenes;
                if (!names.has(step.from) || names.has(step.to)) {
                    const requestError = rollbackRequestErrors.get(step.step);
                    rollbackFailures.push(`${step.step}: rollback readback mismatch${requestError ? ` after ${requestError}` : ""}`);
                }
            }
        }
        catch (rollbackError) {
            rollbackFailures.push(`rollback readback: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
        }
        if (rollbackFailures.length > 0) {
            throw new Error(`Scene rename transaction failed and rollback was not verified (${rollbackFailures.join("; ")}): ${error instanceof Error ? error.message : String(error)}`);
        }
        throw new Error(`Scene rename transaction failed; rollback verified: ${error instanceof Error ? error.message : String(error)}`);
    }
}
function findPrimaryScene(inv) {
    if (inv.sceneNames.includes("panel-ab"))
        return "panel-ab";
    if (inv.currentProgramScene && inv.sceneNames.includes(inv.currentProgramScene)) {
        return inv.currentProgramScene;
    }
    const legacy = inv.sceneNames.find((n) => sceneNameToPair(n) === "AB");
    return legacy ?? inv.sceneNames[0] ?? inv.currentProgramScene;
}
/**
 * Guarded scene-apply plan from live (or synthetic) inventory.
 * Default dry-run documentation; autoApply steps are renames only.
 * panel-cd create/transforms prefer human checklist (WS CreateScene lacks transform copy).
 */
export function planSceneApply(input) {
    const dryRun = input.dryRun !== false;
    const inv = input.inventory;
    const graph = planSceneGraph(inv.currentProgramScene);
    const steps = [];
    const humanChecklist = [];
    const blockers = [];
    const sourceMap = [];
    const claimed = new Set();
    const panelSources = new Map();
    for (const name of inv.inputNames) {
        const panel = resolveCanonicalSource(name);
        if (!panel)
            continue;
        const canonical = CANONICAL_SOURCES[panel];
        sourceMap.push({ observed: name, canonical, panel });
        panelSources.set(panel, [...(panelSources.get(panel) ?? []), name]);
    }
    for (const [panel, names] of panelSources) {
        claimed.add(panel);
        if (names.length > 1) {
            blockers.push(`ambiguous_source_${panel.toLowerCase()}:${names.join("|")}`);
            continue;
        }
        const name = names[0];
        const canonical = CANONICAL_SOURCES[panel];
        if (name.trim() !== canonical) {
            steps.push({
                id: `rename-input-${panel}`,
                action: "rename_input",
                from: name,
                to: canonical,
                detail: `Rename input "${name}" → "${canonical}" via SetInputName (global).`,
                wsSafe: true,
                risk: "low",
                autoApply: true,
            });
        }
    }
    const missingCanonical = ["A", "B", "C", "D"]
        .filter((p) => !claimed.has(p))
        .map((p) => CANONICAL_SOURCES[p]);
    const hasPanelAb = inv.sceneNames.includes("panel-ab");
    const hasPanelCd = inv.sceneNames.includes("panel-cd");
    const primaryScene = findPrimaryScene(inv);
    if (primaryScene && primaryScene !== "panel-ab" && !hasPanelAb) {
        steps.push({
            id: "rename-scene-ab",
            action: "rename_scene",
            from: primaryScene,
            to: "panel-ab",
            detail: `Rename scene "${primaryScene}" → "panel-ab" via SetSceneName.`,
            wsSafe: true,
            risk: "low",
            autoApply: true,
        });
    }
    if (!hasPanelCd) {
        steps.push({
            id: "create-scene-cd",
            action: "create_scene",
            to: "panel-cd",
            detail: 'Create scene "panel-cd". Prefer human duplicate of panel-ab then isolate C/D; WS CreateScene alone lacks transform copy.',
            wsSafe: false,
            risk: "high",
            autoApply: false,
        });
        steps.push({
            id: "duplicate-scene-human",
            action: "duplicate_scene_human",
            from: hasPanelAb || primaryScene === "panel-ab" ? "panel-ab" : primaryScene ?? "panel-ab",
            to: "panel-cd",
            detail: "In OBS: duplicate the primary scene, rename it panel-cd, and preserve any shared audio or overlay sources the user chooses.",
            wsSafe: false,
            risk: "medium",
            autoApply: false,
        });
    }
    steps.push({
        id: "enable-ab-pair",
        action: "set_item_enabled",
        scene: "panel-ab",
        detail: "On panel-ab: enable capture-A + capture-B; disable capture-C + capture-D (pair isolation).",
        wsSafe: true,
        risk: "medium",
        autoApply: false,
    });
    steps.push({
        id: "enable-cd-pair",
        action: "set_item_enabled",
        scene: "panel-cd",
        detail: "On panel-cd: enable capture-C + capture-D; disable capture-A + capture-B.",
        wsSafe: true,
        risk: "medium",
        autoApply: false,
    });
    steps.push({
        id: "prefer-display-crops",
        action: "prefer_display_crop",
        detail: "For stability, consider monitor_capture with cropped halves instead of fragile window-title bindings. Preserve the current secondary resolution unless the operator explicitly approves a display-mode change.",
        wsSafe: false,
        risk: "medium",
        autoApply: false,
    });
    steps.push({
        id: "honest-pixels-cd",
        action: "honest_pixel_policy",
        detail: "Preserve pixels by default: place capture-C/D at 1:1 or integer scale with pillarbox/letterbox bars. Reject automatic scale-to-fill stretching. Never auto-change Windows display mode.",
        wsSafe: false,
        risk: "low",
        autoApply: false,
    });
    humanChecklist.push("Stop recording/stream before any scene graph mutation (doctor recording-idle must pass).", "Snapshot scene collection or profile:backup first.", 'Rename sources: " LEFT A" / RIGHT B / LEFT C / RIGHT D → capture-A..D (trim leading spaces).', "Rename the primary dual-pane scene to panel-ab, or confirm it already has that name.", "Duplicate panel-ab → panel-cd; isolate pair visibility (AB vs CD).", "For panel-cd, prefer 1:1/integer scaling with black bars. Any display-mode change requires explicit operator approval. Never auto scale-to-fill.", "Optional M3: convert window captures to display-region crops for robotic stability.", "Useful desktop applications may cut AB<->CD. OBS-on-D holds the last pair (obs_recursion_guard); the daemon never requires OBS self-capture.", 'After explicit approval: $env:LEGENDS_OBS_DRY_RUN="false"; lobs vision-switch:scene-apply --mode renames-only --confirm --go "<note>"', "Prove: vision-switch:status/plan against GetCurrentProgramScene; manual Fade AB↔CD; arm tick only when idle.");
    if (inv.recording === true)
        blockers.push("recording_active");
    if (inv.streaming === true)
        blockers.push("streaming_active");
    if (missingCanonical.length > 0) {
        blockers.push(`missing_sources:${missingCanonical.join(",")}`);
        humanChecklist.unshift(`Missing capture sources in inventory: ${missingCanonical.join(", ")}. Create window or display captures before rename.`);
    }
    const autoApplyable = steps.filter((s) => s.autoApply && s.wsSafe);
    return {
        ok: true,
        dryRun,
        graph,
        observed: {
            currentProgramScene: inv.currentProgramScene,
            sceneNames: [...inv.sceneNames],
            sourceMap,
            missingCanonical,
            hasPanelAb,
            hasPanelCd,
            primaryScene,
        },
        steps,
        autoApplyable,
        humanChecklist,
        blockers,
        resolutionPolicy: graph.resolutionPolicy,
        pixelPolicy: graph.pixelPolicy,
        captureStrategy: "Useful desktop applications may occupy AB and CD pairs. Prefer display-region crops where stable and window capture for explicit application bindings. OBS self-capture is a non-goal, so hold the last pair when OBS is foreground on D. Preserve shared overlays and avoid automatic stretching.",
        goNoteRequired: "Live apply requires LEGENDS_OBS_DRY_RUN=false, --confirm, and --go <note>. Default mode is dry-run plan only. Create scene remains human checklist.",
    };
}
/** Build inventory shape from a minimal live snapshot for planSceneApply. */
export function inventoryFromLiveSnapshot(snapshot) {
    const primary = snapshot.scenes.find((s) => s.sceneName === snapshot.currentProgramScene) ??
        snapshot.scenes[0];
    return {
        currentProgramScene: snapshot.currentProgramScene,
        sceneNames: snapshot.scenes.map((s) => s.sceneName),
        inputNames: snapshot.inputs.map((i) => i.inputName),
        primarySceneItems: (primary?.items ?? []).map((item) => ({
            sourceName: item.sourceName,
            enabled: item.sceneItemEnabled,
        })),
        monitors: (snapshot.monitors ?? []).map((m) => ({
            name: m.monitorName,
            width: m.monitorWidth,
            height: m.monitorHeight,
            index: m.monitorIndex,
        })),
        recording: snapshot.activity?.recording === true,
        streaming: snapshot.activity?.streaming === true,
    };
}
//# sourceMappingURL=vision-switch.js.map