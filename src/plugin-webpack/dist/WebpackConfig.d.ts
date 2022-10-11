import webpack, { Configuration } from 'webpack';
import { WebpackPluginConfig, WebpackPluginEntryPoint, WebpackPreloadEntryPoint, WebpackPreloadEntryPoint2 } from './Config';
declare type WebpackMode = 'production' | 'development';
export declare type ConfigurationFactory = (env: string | Record<string, string | boolean | number> | unknown, args: Record<string, unknown>) => Configuration | Promise<Configuration>;
export default class WebpackConfigGenerator {
    private isProd;
    private pluginConfig;
    private port;
    private projectDir;
    private webpackDir;
    constructor(pluginConfig: WebpackPluginConfig, projectDir: string, isProd: boolean, port: number);
    resolveConfig(config: Configuration | ConfigurationFactory | string): Promise<Configuration>;
    preprocessConfig: (config: ConfigurationFactory) => Promise<Configuration>;
    get mode(): WebpackMode;
    get rendererSourceMapOption(): string;
    rendererTarget(entryPoint: WebpackPluginEntryPoint): string;
    rendererEntryPoint(entryPoint: WebpackPluginEntryPoint, inRendererDir: boolean, basename: string): string;
    toEnvironmentVariable(entryPoint: WebpackPluginEntryPoint, preload?: boolean): string;
    getPreloadDefine(entryPoint: WebpackPluginEntryPoint): string;
    getStandalonePreloadDefine(entryPoint: WebpackPreloadEntryPoint2): string;
    getDefines(inRendererDir?: boolean): Record<string, string>;
    getMainConfig(): Promise<Configuration>;
    getStandalonePreloadConfig(entryPoint: WebpackPreloadEntryPoint2): Promise<webpack.Configuration>;
    getPreloadConfigForEntryPoint(parentPoint: WebpackPluginEntryPoint, entryPoint: WebpackPreloadEntryPoint): Promise<Configuration>;
    getRendererConfig(entryPoints: WebpackPluginEntryPoint[]): Promise<Configuration[]>;
}
export {};
//# sourceMappingURL=WebpackConfig.d.ts.map