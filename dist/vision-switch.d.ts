/**
 * Legends Vision Switcher - deterministic panel->pair->scene cut planner + daemon.
 * Live SetCurrentProgramScene only when dryRun=false and confirm.
 * Scope: useful desktop applications moving between AB|CD panel pairs.
 * OBS-on-D holds last pair (obs_recursion_guard). Daemon never blocked on OBS self-capture.
 * No LLM in the cut loop. Honest pixels: no OBS stretch default; display-mode changes require explicit operator approval.
 */
export type Panel = "A" | "B" | "C" | "D";
export type Pair = "AB" | "CD";
export declare const CANONICAL_SCENES: {
    readonly AB: "panel-ab";
    readonly CD: "panel-cd";
};
export declare const LEGACY_SCENE_ALIASES: Record<string, Pair>;
export declare const DEFAULT_ACTIVE_PANEL_SCRIPT: string | undefined;
export declare const STATE_FILE_NAME = "vision-switch-state.json";
/** Focus class for the optional Vision Switcher. */
export type FocusClass = "useful" | "obs" | "other";
/**
 * Useful human work surfaces (P0/P1). Process basename match, case-insensitive.
 * Browsers and common desktop applications. Not OBS (self-capture is a non-goal).
 */
export declare const USEFUL_FOCUS_PROCESSES: readonly ["chrome", "msedge", "msedgewebview2", "brave", "firefox", "opera", "vivaldi", "chatgpt", "codex", "code", "code - insiders", "cursor", "devenv", "windowsterminal", "windows terminal", "wt", "powershell", "pwsh", "windowspowershell", "slack", "discord", "notion", "figma", "obsidian", "warp", "alacritty", "wezterm-gui", "hyper"];
/** Exact OBS process basenames (never substring — "obsidian" must not match). */
export declare const OBS_FOCUS_PROCESSES: readonly ["obs", "obs64"];
export declare function processBaseName(processName?: string | null): string;
export declare function isObsProcess(processName?: string | null): boolean;
export declare function isUsefulFocusProcess(processName?: string | null, title?: string | null): boolean;
/**
 * Classify foreground process for plan/status receipts.
 * obs -> hold last pair on D/CD; useful -> primary cut candidates; other -> geometry still maps.
 */
export declare function classifyFocusProcess(processName?: string | null, title?: string | null): FocusClass;
/**
 * OBS recursion guard: FG is OBS on panel D (or CD pair geometry).
 * Product must not require OBS self-capture; hold last pair and keep daemon alive.
 */
export declare function shouldHoldLastPairForObs(sample: {
    panel: Panel;
    pair?: Pair;
    process?: string;
}): boolean;
export declare function panelToPair(panel: Panel): Pair;
export declare function pairToSceneName(pair: Pair): string;
export declare function sceneNameToPair(name: string): Pair | null;
export type ActivePanelSample = {
    panel: Panel;
    pair: Pair;
    process?: string;
    title?: string;
    hwnd?: number;
    sceneHint?: string;
    display?: string;
    confidence?: string;
    source?: "shell" | "flag" | "fixture";
};
export type VisionSwitchState = {
    armed: boolean;
    frozen: boolean;
    lastPanel: Panel | null;
    lastPair: Pair | null;
    lastScene: string | null;
    consecutiveNewPair: number;
    lastCutAt: string | null;
    lastSampleAt: string | null;
    debounceMs: number;
    hysteresisSamples: number;
    minHoldMs: number;
    updatedAt: string | null;
};
export declare function defaultVisionSwitchState(): VisionSwitchState;
export declare function stateFilePath(stateDir: string): string;
export declare function loadVisionSwitchState(stateDir: string): Promise<VisionSwitchState>;
export declare function saveVisionSwitchState(stateDir: string, state: VisionSwitchState): Promise<string>;
export type VisionSwitchPlan = {
    ok: true;
    dryRun: boolean;
    sample: ActivePanelSample;
    targetPair: Pair;
    targetScene: string;
    currentScene: string | null;
    currentPair: Pair | null;
    wouldCut: boolean;
    reason: string;
    residual: string | null;
    armed: boolean;
    frozen: boolean;
    hysteresisReady?: boolean;
    consecutiveNewPair?: number;
    /** Focus class for receipts (useful | obs | other). */
    focusClass: FocusClass;
    /** True when OBS-on-D/CD holds previous pair (daemon continues). */
    holdLastPair: boolean;
    heldPair: Pair | null;
    chromeFirst: true;
};
/**
 * Pure planner: given sample + state + current OBS scene, decide cut.
 * Hysteresis readiness is caller-supplied (state.consecutiveNewPair already advanced).
 */
export declare function planVisionCut(input: {
    sample: ActivePanelSample;
    state: VisionSwitchState;
    currentProgramScene: string | null;
    dryRun: boolean;
    nowMs?: number;
    hysteresisReady?: boolean;
    outputsActive?: boolean;
}): VisionSwitchPlan;
export declare function applyHysteresis(state: VisionSwitchState, targetPair: Pair): {
    state: VisionSwitchState;
    ready: boolean;
};
/** After a successful cut (or adopting a pair without cut), lock lastPair. */
export declare function markCutApplied(state: VisionSwitchState, sample: ActivePanelSample, sceneName: string, atIso: string): VisionSwitchState;
export declare function markSampleOnly(state: VisionSwitchState, sample: ActivePanelSample, atIso: string): VisionSwitchState;
/** Honest pixel placement for a lower-resolution CD pair inside a 4K program. */
export type HonestPixelOptionId = "A_windows_4k_render" | "B_native_pillarbox" | "C_second_4k_monitor" | "D_stretch_rejected";
export type HonestPixelOption = {
    id: HonestPixelOptionId;
    title: string;
    allowed: boolean;
    /** Safe default when no display-mode change has been approved. */
    isDefault: boolean;
    requiresExplicitApproval: boolean;
    summary: string;
};
/** Production options A/B/C allowed; D (stretch) never ships as default. */
export declare const HONEST_PIXEL_OPTIONS: readonly HonestPixelOption[];
export declare const DEFAULT_HONEST_PIXEL_OPTION: HonestPixelOptionId;
export type HonestPixelPolicy = {
    defaultOption: HonestPixelOptionId;
    options: readonly HonestPixelOption[];
    rejectedDefault: "D_stretch_rejected";
    law: string;
};
export declare function buildHonestPixelPolicy(): HonestPixelPolicy;
export declare function honestPixelPolicySummary(): string;
export type SceneGraphPlan = {
    currentScene: string | null;
    proposed: Array<{
        sceneName: string;
        pair: Pair;
        leftSource: string;
        rightSource: string;
        notes: string;
    }>;
    renameFrom?: Array<{
        from: string;
        to: string;
    }>;
    resolutionPolicy: string;
    /** A/B/C allowed; D stretch never default (taste lock). */
    pixelPolicy: HonestPixelPolicy;
};
export declare function planSceneGraph(currentSceneName: string | null): SceneGraphPlan;
/** Parse Shell Get-ActivePanel JSON (or fixture) into a typed sample. */
export declare function parseActivePanelJson(raw: unknown, source?: ActivePanelSample["source"]): ActivePanelSample;
export declare function sampleFromPanelFlag(panel: Panel, extras?: {
    process?: string;
    title?: string;
}): ActivePanelSample;
/**
 * Read active panel JSON from a sensor file or Node/native sensor script.
 * No LLM. Fails closed if sensor is missing or output is unparseable.
 */
export declare function sampleActivePanelFromShell(options?: {
    scriptPath?: string;
    timeoutMs?: number;
}): Promise<ActivePanelSample>;
export type VisionTickResult = {
    ok: true;
    dryRun: boolean;
    cut: boolean;
    authorized: boolean;
    sample: ActivePanelSample;
    plan: VisionSwitchPlan;
    state: VisionSwitchState;
    requirement?: string;
    note?: string;
};
/**
 * One poll cycle: sample already obtained → hysteresis → plan → state update (no WS).
 * Caller performs OBS cut when result.cut && authorized and then markCutApplied.
 */
export declare function evaluateVisionTick(input: {
    sample: ActivePanelSample;
    state: VisionSwitchState;
    currentProgramScene: string | null;
    dryRun: boolean;
    authorized: boolean;
    nowMs?: number;
    outputsActive?: boolean;
}): VisionTickResult;
export type DaemonOptions = {
    intervalMs: number;
    maxTicks: number | null;
    dryRun: boolean;
    authorized: boolean;
};
export declare function resolveDaemonOptions(input: {
    intervalMs?: number;
    maxTicks?: number | null;
    dryRun: boolean;
    authorized: boolean;
}): DaemonOptions;
export declare function sleepInterval(ms: number): Promise<void>;
export declare const CANONICAL_SOURCES: {
    readonly A: "capture-A";
    readonly B: "capture-B";
    readonly C: "capture-C";
    readonly D: "capture-D";
};
/** Map observed input names (trim + lower) → panel letter. */
export declare const LEGACY_SOURCE_ALIASES: Record<string, keyof typeof CANONICAL_SOURCES>;
export declare function normalizeSourceKey(name: string): string;
export declare function resolveCanonicalSource(name: string): keyof typeof CANONICAL_SOURCES | null;
export type SceneApplyAction = "rename_scene" | "rename_input" | "create_scene" | "duplicate_scene_human" | "set_item_enabled" | "prefer_display_crop" | "letterbox_policy" | "honest_pixel_policy" | "human_checklist";
export type SceneApplyStep = {
    id: string;
    action: SceneApplyAction;
    from?: string;
    to?: string;
    scene?: string;
    source?: string;
    enabled?: boolean;
    detail: string;
    /** True only for simple SetSceneName / SetInputName style ops. */
    wsSafe: boolean;
    risk: "low" | "medium" | "high";
    autoApply: boolean;
};
export type SceneApplyInventory = {
    currentProgramScene: string | null;
    sceneNames: string[];
    inputNames: string[];
    primarySceneItems?: Array<{
        sourceName: string;
        enabled?: boolean;
    }>;
    monitors?: Array<{
        name?: string;
        width?: number;
        height?: number;
        index?: number;
    }>;
    recording?: boolean;
    streaming?: boolean;
};
export type SceneApplyPlan = {
    ok: true;
    dryRun: boolean;
    graph: SceneGraphPlan;
    observed: {
        currentProgramScene: string | null;
        sceneNames: string[];
        sourceMap: Array<{
            observed: string;
            canonical: string;
            panel: keyof typeof CANONICAL_SOURCES;
        }>;
        missingCanonical: string[];
        hasPanelAb: boolean;
        hasPanelCd: boolean;
        primaryScene: string | null;
    };
    steps: SceneApplyStep[];
    autoApplyable: SceneApplyStep[];
    humanChecklist: string[];
    blockers: string[];
    resolutionPolicy: string;
    /** Documented A/B/C; D stretch never default. */
    pixelPolicy: HonestPixelPolicy;
    captureStrategy: string;
    goNoteRequired: string;
};
type RenameClient = {
    request(requestType: string, requestData?: Record<string, unknown>): Promise<Record<string, unknown>>;
};
export declare function applyRenameStepsTransactional(client: RenameClient, steps: SceneApplyStep[]): Promise<Array<{
    step: string;
    from: string;
    to: string;
    ok: true;
}>>;
/**
 * Guarded scene-apply plan from live (or synthetic) inventory.
 * Default dry-run documentation; autoApply steps are renames only.
 * panel-cd create/transforms prefer human checklist (WS CreateScene lacks transform copy).
 */
export declare function planSceneApply(input: {
    inventory: SceneApplyInventory;
    dryRun?: boolean;
}): SceneApplyPlan;
/** Build inventory shape from a minimal live snapshot for planSceneApply. */
export declare function inventoryFromLiveSnapshot(snapshot: {
    currentProgramScene: string | null;
    scenes: Array<{
        sceneName: string;
        items?: Array<{
            sourceName: string;
            sceneItemEnabled?: boolean;
        }>;
    }>;
    inputs: Array<{
        inputName: string;
    }>;
    monitors?: Array<{
        monitorName?: string;
        monitorWidth?: number;
        monitorHeight?: number;
        monitorIndex?: number;
    }>;
    activity?: {
        recording?: boolean;
        streaming?: boolean;
    };
}): SceneApplyInventory;
export {};
