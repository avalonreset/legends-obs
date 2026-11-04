export interface KitConfig {
    repoRoot: string;
    obsConfigRoot: string;
    websocketConfigPath: string;
    stateDir: string;
    ffprobePath: string;
    dryRun: boolean;
    requirePrimaryMicrophone: boolean;
    host: string;
}
export declare function resolveConfig(env?: NodeJS.ProcessEnv): KitConfig;
