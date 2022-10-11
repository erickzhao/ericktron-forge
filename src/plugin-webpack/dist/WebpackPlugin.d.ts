import PluginBase from '@electron-forge/plugin-base';
import { ForgeConfig, ForgeHookFn } from '@electron-forge/shared-types';
import Logger from '@electron-forge/web-multi-logger';
import webpack from 'webpack';
import { WebpackPluginConfig } from './Config';
import WebpackConfigGenerator from './WebpackConfig';
declare type WebpackToJsonOptions = Parameters<webpack.Stats['toJson']>[0];
export default class WebpackPlugin extends PluginBase<WebpackPluginConfig> {
    name: string;
    private isProd;
    private projectDir;
    private baseDir;
    private _configGenerator;
    private watchers;
    private servers;
    private loggers;
    private port;
    private loggerPort;
    constructor(c: WebpackPluginConfig);
    private isValidPort;
    exitHandler: (options: {
        cleanup?: boolean;
        exit?: boolean;
    }, err?: Error | undefined) => void;
    writeJSONStats(type: string, stats: webpack.Stats | undefined, statsOptions: WebpackToJsonOptions, suffix: string): Promise<void>;
    private runWebpack;
    init: (dir: string) => void;
    setDirectories: (dir: string) => void;
    get configGenerator(): WebpackConfigGenerator;
    private loggedOutputUrl;
    getHook(name: string): ForgeHookFn | null;
    resolveForgeConfig: (forgeConfig: ForgeConfig) => Promise<ForgeConfig>;
    packageAfterCopy: (_forgeConfig: ForgeConfig, buildPath: string) => Promise<void>;
    compileMain: (watch?: boolean, logger?: Logger | undefined) => Promise<void>;
    compileRenderers: (watch?: boolean) => Promise<void>;
    launchDevServers: (logger: Logger) => Promise<void>;
    devServerOptions(): Record<string, unknown>;
    private alreadyStarted;
    startLogic(): Promise<false>;
}
export { WebpackPluginConfig };
//# sourceMappingURL=WebpackPlugin.d.ts.map