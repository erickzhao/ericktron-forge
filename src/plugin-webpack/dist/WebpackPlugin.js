"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "WebpackPluginConfig", {
    enumerable: true,
    get: function() {
        return _config.WebpackPluginConfig;
    }
});
exports.default = void 0;
var _asyncOra = require("@electron-forge/async-ora");
var _pluginBase = _interopRequireDefault(require("@electron-forge/plugin-base"));
var _webMultiLogger = _interopRequireDefault(require("@electron-forge/web-multi-logger"));
var _chalk = _interopRequireDefault(require("chalk"));
var _debug = _interopRequireDefault(require("debug"));
var _fsExtra = _interopRequireDefault(require("fs-extra"));
var _webpackMerge = require("webpack-merge");
var _path = _interopRequireDefault(require("path"));
var _core = require("@electron-forge/core");
var _webpack = _interopRequireDefault(require("webpack"));
var _webpackDevServer = _interopRequireDefault(require("webpack-dev-server"));
var _config = require("./Config");
var _electronForgeLogging = _interopRequireDefault(require("./util/ElectronForgeLogging"));
var _once = _interopRequireDefault(require("./util/once"));
var _webpackConfig = _interopRequireDefault(require("./WebpackConfig"));
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const d = (0, _debug).default('electron-forge:plugin:webpack');
const DEFAULT_PORT = 3000;
const DEFAULT_LOGGER_PORT = 9000;
class WebpackPlugin extends _pluginBase.default {
    constructor(c){
        super(c);
        this.name = 'webpack';
        this.isProd = false;
        this.watchers = [];
        this.servers = [];
        this.loggers = [];
        this.port = DEFAULT_PORT;
        this.loggerPort = DEFAULT_LOGGER_PORT;
        this.isValidPort = (port)=>{
            if (port < 1024) {
                throw new Error(`Cannot specify port (${port}) below 1024, as they are privileged`);
            } else if (port > 65535) {
                throw new Error(`Port specified (${port}) is not a valid TCP port.`);
            } else {
                return true;
            }
        };
        this.exitHandler = (options, err)=>{
            d('handling process exit with:', options);
            if (options.cleanup) {
                for (const watcher of this.watchers){
                    d('cleaning webpack watcher');
                    watcher.close(()=>{
                    /* Do nothing when the watcher closes */ });
                }
                this.watchers = [];
                for (const server of this.servers){
                    d('cleaning http server');
                    server.close();
                }
                this.servers = [];
                for (const logger of this.loggers){
                    d('stopping logger');
                    logger.stop();
                }
                this.loggers = [];
            }
            if (err) console.error(err.stack);
            // Why: This is literally what the option says to do.
            // eslint-disable-next-line no-process-exit
            if (options.exit) process.exit();
        };
        // eslint-disable-next-line max-len
        this.runWebpack = async (options, isRenderer = false)=>{
            return new Promise((resolve, reject)=>{
                (0, _webpack).default(options).run(async (err, stats)=>{
                    if (isRenderer && this.config.renderer.jsonStats) {
                        var ref;
                        for (const [index, entryStats] of ((ref = stats === null || stats === void 0 ? void 0 : stats.stats) !== null && ref !== void 0 ? ref : []).entries()){
                            const name = this.config.renderer.entryPoints[index].name;
                            await this.writeJSONStats('renderer', entryStats, options[index].stats, name);
                        }
                    }
                    if (err) {
                        return reject(err);
                    }
                    return resolve(stats);
                });
            });
        };
        this.init = (dir)=>{
            this.setDirectories(dir);
            d('hooking process events');
            process.on('exit', (_code)=>this.exitHandler({
                    cleanup: true
                })
            );
            process.on('SIGINT', (_signal)=>this.exitHandler({
                    exit: true
                })
            );
        };
        this.setDirectories = (dir)=>{
            this.projectDir = dir;
            this.baseDir = _path.default.resolve(dir, '.webpack');
        };
        this.loggedOutputUrl = false;
        this.resolveForgeConfig = async (forgeConfig)=>{
            if (!forgeConfig.packagerConfig) {
                forgeConfig.packagerConfig = {};
            }
            if (forgeConfig.packagerConfig.ignore) {
                if (typeof forgeConfig.packagerConfig.ignore !== 'function') {
                    console.error(_chalk.default.red(`You have set packagerConfig.ignore, the Electron Forge webpack plugin normally sets this automatically.

Your packaged app may be larger than expected if you dont ignore everything other than the '.webpack' folder`));
                }
                return forgeConfig;
            }
            forgeConfig.packagerConfig.ignore = (file)=>{
                if (!file) return false;
                if (this.config.jsonStats && file.endsWith(_path.default.join('.webpack', 'main', 'stats.json'))) {
                    return true;
                }
                if (this.config.renderer.jsonStats && file.endsWith(_path.default.join('.webpack', 'renderer', 'stats.json'))) {
                    return true;
                }
                if (!this.config.packageSourceMaps && /[^/\\]+\.js\.map$/.test(file)) {
                    return true;
                }
                return !/^[/\\]\.webpack($|[/\\]).*$/.test(file);
            };
            return forgeConfig;
        };
        this.packageAfterCopy = async (_forgeConfig, buildPath)=>{
            var ref;
            const pj = await _fsExtra.default.readJson(_path.default.resolve(this.projectDir, 'package.json'));
            if (!((ref = pj.main) === null || ref === void 0 ? void 0 : ref.endsWith('.webpack/main'))) {
                throw new Error(`Electron Forge is configured to use the Webpack plugin. The plugin expects the
"main" entry point in "package.json" to be ".webpack/main" (where the plugin outputs
the generated files). Instead, it is ${JSON.stringify(pj.main)}`);
            }
            if (pj.config) {
                delete pj.config.forge;
            }
            pj.devDependencies = {};
            pj.dependencies = {};
            pj.optionalDependencies = {};
            pj.peerDependencies = {};
            await _fsExtra.default.writeJson(_path.default.resolve(buildPath, 'package.json'), pj, {
                spaces: 2
            });
            await _fsExtra.default.mkdirp(_path.default.resolve(buildPath, 'node_modules'));
        };
        this.compileMain = async (watch = false, logger)=>{
            let tab;
            if (logger) {
                tab = logger.createTab('Main Process');
            }
            await (0, _asyncOra).asyncOra('Compiling Main Process Code', async ()=>{
                const mainConfig = await this.configGenerator.getMainConfig();
                await new Promise((resolve, reject)=>{
                    const compiler = (0, _webpack).default(mainConfig);
                    const [onceResolve, onceReject] = (0, _once).default(resolve, reject);
                    const cb = async (err, stats)=>{
                        if (tab && stats) {
                            tab.log(stats.toString({
                                colors: true
                            }));
                        }
                        if (this.config.jsonStats) {
                            await this.writeJSONStats('main', stats, mainConfig.stats, 'main');
                        }
                        if (err) return onceReject(err);
                        if (!watch && (stats === null || stats === void 0 ? void 0 : stats.hasErrors())) {
                            return onceReject(new Error(`Compilation errors in the main process: ${stats.toString()}`));
                        }
                        return onceResolve(undefined);
                    };
                    if (watch) {
                        this.watchers.push(compiler.watch({}, cb));
                    } else {
                        compiler.run(cb);
                    }
                });
            });
        };
        this.compileRenderers = async (watch = false)=>{
            await (0, _asyncOra).asyncOra('Compiling Renderer Template', async ()=>{
                const stats = await this.runWebpack(await this.configGenerator.getRendererConfig(this.config.renderer.entryPoints), true);
                if (!watch && (stats === null || stats === void 0 ? void 0 : stats.hasErrors())) {
                    throw new Error(`Compilation errors in the renderer: ${stats.toString()}`);
                }
            });
            for (const entryPoint of this.config.renderer.entryPoints){
                if (entryPoint.preload) {
                    await (0, _asyncOra).asyncOra(`Compiling Renderer Preload: ${_chalk.default.cyan(entryPoint.name)}`, async ()=>{
                        const stats = await this.runWebpack(// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        [
                            await this.configGenerator.getPreloadConfigForEntryPoint(entryPoint, entryPoint.preload)
                        ]);
                        if (stats === null || stats === void 0 ? void 0 : stats.hasErrors()) {
                            throw new Error(`Compilation errors in the preload (${entryPoint.name}): ${stats.toString()}`);
                        }
                    });
                }
            }
            if (Array.isArray(this.config.renderer.preloadEntries)) {
                for (const preload of this.config.renderer.preloadEntries){
                    await (0, _asyncOra).asyncOra(`Compiling Extra Preload Scripts`, async ()=>{
                        const stats = await this.runWebpack(// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                        [
                            await this.configGenerator.getStandalonePreloadConfig(preload)
                        ]);
                        if (stats === null || stats === void 0 ? void 0 : stats.hasErrors()) {
                            throw new Error(`Compilation errors in the preload): ${stats.toString()}`);
                        }
                    });
                }
            }
        };
        this.launchDevServers = async (logger)=>{
            await (0, _asyncOra).asyncOra('Launching Dev Servers for Renderer Process Code', async ()=>{
                const tab = logger.createTab('Renderers');
                const pluginLogs = new _electronForgeLogging.default(tab);
                const config = await this.configGenerator.getRendererConfig(this.config.renderer.entryPoints);
                if (config.length === 0) {
                    return;
                }
                for (const entryConfig of config){
                    if (!entryConfig.plugins) entryConfig.plugins = [];
                    entryConfig.plugins.push(pluginLogs);
                }
                const compiler = (0, _webpack).default(config);
                const webpackDevServer = new _webpackDevServer.default(this.devServerOptions(), compiler);
                await webpackDevServer.start();
                this.servers.push(webpackDevServer.server);
            });
            await (0, _asyncOra).asyncOra('Compiling Preload Scripts', async ()=>{
                for (const entryPoint of this.config.renderer.entryPoints){
                    if (entryPoint.preload) {
                        const config = await this.configGenerator.getPreloadConfigForEntryPoint(entryPoint, entryPoint.preload);
                        await new Promise((resolve, reject)=>{
                            const tab = logger.createTab(`${entryPoint.name} - Preload`);
                            const [onceResolve, onceReject] = (0, _once).default(resolve, reject);
                            this.watchers.push((0, _webpack).default(config).watch({}, (err, stats)=>{
                                if (stats) {
                                    tab.log(stats.toString({
                                        colors: true
                                    }));
                                }
                                if (err) return onceReject(err);
                                return onceResolve(undefined);
                            }));
                        });
                    }
                }
                if (Array.isArray(this.config.renderer.preloadEntries)) {
                    for (const preload of this.config.renderer.preloadEntries){
                        const config = await this.configGenerator.getStandalonePreloadConfig(preload);
                        await new Promise((resolve, reject)=>{
                            const tab = logger.createTab(`AAAAAAAAAAAAA`);
                            const [onceResolve, onceReject] = (0, _once).default(resolve, reject);
                            this.watchers.push((0, _webpack).default(config).watch({}, (err, stats)=>{
                                if (stats) {
                                    tab.log(stats.toString({
                                        colors: true
                                    }));
                                }
                                if (err) return onceReject(err);
                                return onceResolve(undefined);
                            }));
                        });
                    }
                }
            });
        };
        this.alreadyStarted = false;
        if (c.port) {
            if (this.isValidPort(c.port)) {
                this.port = c.port;
            }
        }
        if (c.loggerPort) {
            if (this.isValidPort(c.loggerPort)) {
                this.loggerPort = c.loggerPort;
            }
        }
        this.startLogic = this.startLogic.bind(this);
        this.getHook = this.getHook.bind(this);
    }
    async writeJSONStats(type, stats, statsOptions, suffix) {
        if (!stats) return;
        d(`Writing JSON stats for ${type} config`);
        const jsonStats = stats.toJson(statsOptions);
        const jsonStatsFilename = _path.default.resolve(this.baseDir, type, `stats-${suffix}.json`);
        await _fsExtra.default.writeJson(jsonStatsFilename, jsonStats, {
            spaces: 2
        });
    }
    get configGenerator() {
        // eslint-disable-next-line no-underscore-dangle
        if (!this._configGenerator) {
            // eslint-disable-next-line no-underscore-dangle
            this._configGenerator = new _webpackConfig.default(this.config, this.projectDir, this.isProd, this.port);
        }
        // eslint-disable-next-line no-underscore-dangle
        return this._configGenerator;
    }
    getHook(name) {
        switch(name){
            case 'prePackage':
                this.isProd = true;
                return async (config, platform, arch)=>{
                    await _fsExtra.default.remove(this.baseDir);
                    await _core.utils.rebuildHook(this.projectDir, await _core.utils.getElectronVersion(this.projectDir, await _fsExtra.default.readJson(_path.default.join(this.projectDir, 'package.json'))), platform, arch, config.electronRebuildConfig);
                    await this.compileMain();
                    await this.compileRenderers();
                };
            case 'postStart':
                return async (_config, child)=>{
                    if (!this.loggedOutputUrl) {
                        console.info(`\n\nWebpack Output Available: ${_chalk.default.cyan(`http://localhost:${this.loggerPort}`)}\n`);
                        this.loggedOutputUrl = true;
                    }
                    d('hooking electron process exit');
                    child.on('exit', ()=>{
                        if (child.restarted) return;
                        this.exitHandler({
                            cleanup: true,
                            exit: true
                        });
                    });
                };
            case 'resolveForgeConfig':
                return this.resolveForgeConfig;
            case 'packageAfterCopy':
                return this.packageAfterCopy;
            default:
                return null;
        }
    }
    devServerOptions() {
        var _devContentSecurityPolicy;
        const cspDirectives = (_devContentSecurityPolicy = this.config.devContentSecurityPolicy) !== null && _devContentSecurityPolicy !== void 0 ? _devContentSecurityPolicy : "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:";
        const defaults = {
            hot: true,
            devMiddleware: {
                writeToDisk: true
            },
            historyApiFallback: true
        };
        const overrides = {
            port: this.port,
            setupExitSignals: true,
            static: _path.default.resolve(this.baseDir, 'renderer'),
            headers: {
                'Content-Security-Policy': cspDirectives
            }
        };
        var _devServer;
        return (0, _webpackMerge).merge(defaults, (_devServer = this.config.devServer) !== null && _devServer !== void 0 ? _devServer : {}, overrides);
    }
    async startLogic() {
        if (this.alreadyStarted) return false;
        this.alreadyStarted = true;
        await _fsExtra.default.remove(this.baseDir);
        const logger = new _webMultiLogger.default(this.loggerPort);
        this.loggers.push(logger);
        await this.compileMain(true, logger);
        await this.launchDevServers(logger);
        await logger.start();
        return false;
    }
}
exports.default = WebpackPlugin;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9XZWJwYWNrUGx1Z2luLnRzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludCBcIm5vLWNvbnNvbGVcIjogXCJvZmZcIiAqL1xuaW1wb3J0IHsgYXN5bmNPcmEgfSBmcm9tICdAZWxlY3Ryb24tZm9yZ2UvYXN5bmMtb3JhJztcbmltcG9ydCBQbHVnaW5CYXNlIGZyb20gJ0BlbGVjdHJvbi1mb3JnZS9wbHVnaW4tYmFzZSc7XG5pbXBvcnQgeyBFbGVjdHJvblByb2Nlc3MsIEZvcmdlQXJjaCwgRm9yZ2VDb25maWcsIEZvcmdlSG9va0ZuLCBGb3JnZVBsYXRmb3JtIH0gZnJvbSAnQGVsZWN0cm9uLWZvcmdlL3NoYXJlZC10eXBlcyc7XG5pbXBvcnQgTG9nZ2VyLCB7IFRhYiB9IGZyb20gJ0BlbGVjdHJvbi1mb3JnZS93ZWItbXVsdGktbG9nZ2VyJztcblxuaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcbmltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1Zyc7XG5pbXBvcnQgZnMgZnJvbSAnZnMtZXh0cmEnO1xuaW1wb3J0IGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgeyBtZXJnZSB9IGZyb20gJ3dlYnBhY2stbWVyZ2UnO1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyB1dGlscyB9IGZyb20gJ0BlbGVjdHJvbi1mb3JnZS9jb3JlJztcbmltcG9ydCB3ZWJwYWNrLCB7IENvbmZpZ3VyYXRpb24sIFdhdGNoaW5nIH0gZnJvbSAnd2VicGFjayc7XG5pbXBvcnQgV2VicGFja0RldlNlcnZlciBmcm9tICd3ZWJwYWNrLWRldi1zZXJ2ZXInO1xuXG5pbXBvcnQgeyBXZWJwYWNrUGx1Z2luQ29uZmlnIH0gZnJvbSAnLi9Db25maWcnO1xuaW1wb3J0IEVsZWN0cm9uRm9yZ2VMb2dnaW5nUGx1Z2luIGZyb20gJy4vdXRpbC9FbGVjdHJvbkZvcmdlTG9nZ2luZyc7XG5pbXBvcnQgb25jZSBmcm9tICcuL3V0aWwvb25jZSc7XG5pbXBvcnQgV2VicGFja0NvbmZpZ0dlbmVyYXRvciBmcm9tICcuL1dlYnBhY2tDb25maWcnO1xuXG5jb25zdCBkID0gZGVidWcoJ2VsZWN0cm9uLWZvcmdlOnBsdWdpbjp3ZWJwYWNrJyk7XG5jb25zdCBERUZBVUxUX1BPUlQgPSAzMDAwO1xuY29uc3QgREVGQVVMVF9MT0dHRVJfUE9SVCA9IDkwMDA7XG5cbnR5cGUgV2VicGFja1RvSnNvbk9wdGlvbnMgPSBQYXJhbWV0ZXJzPHdlYnBhY2suU3RhdHNbJ3RvSnNvbiddPlswXTtcbnR5cGUgV2VicGFja1dhdGNoSGFuZGxlciA9IFBhcmFtZXRlcnM8d2VicGFjay5Db21waWxlclsnd2F0Y2gnXT5bMV07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFdlYnBhY2tQbHVnaW4gZXh0ZW5kcyBQbHVnaW5CYXNlPFdlYnBhY2tQbHVnaW5Db25maWc+IHtcbiAgbmFtZSA9ICd3ZWJwYWNrJztcblxuICBwcml2YXRlIGlzUHJvZCA9IGZhbHNlO1xuXG4gIC8vIFRoZSByb290IG9mIHRoZSBFbGVjdHJvbiBhcHBcbiAgcHJpdmF0ZSBwcm9qZWN0RGlyITogc3RyaW5nO1xuXG4gIC8vIFdoZXJlIHRoZSBXZWJwYWNrIG91dHB1dCBpcyBnZW5lcmF0ZWQuIFVzdWFsbHkgYCRwcm9qZWN0RGlyLy53ZWJwYWNrYFxuICBwcml2YXRlIGJhc2VEaXIhOiBzdHJpbmc7XG5cbiAgcHJpdmF0ZSBfY29uZmlnR2VuZXJhdG9yITogV2VicGFja0NvbmZpZ0dlbmVyYXRvcjtcblxuICBwcml2YXRlIHdhdGNoZXJzOiBXYXRjaGluZ1tdID0gW107XG5cbiAgcHJpdmF0ZSBzZXJ2ZXJzOiBodHRwLlNlcnZlcltdID0gW107XG5cbiAgcHJpdmF0ZSBsb2dnZXJzOiBMb2dnZXJbXSA9IFtdO1xuXG4gIHByaXZhdGUgcG9ydCA9IERFRkFVTFRfUE9SVDtcblxuICBwcml2YXRlIGxvZ2dlclBvcnQgPSBERUZBVUxUX0xPR0dFUl9QT1JUO1xuXG4gIGNvbnN0cnVjdG9yKGM6IFdlYnBhY2tQbHVnaW5Db25maWcpIHtcbiAgICBzdXBlcihjKTtcblxuICAgIGlmIChjLnBvcnQpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWRQb3J0KGMucG9ydCkpIHtcbiAgICAgICAgdGhpcy5wb3J0ID0gYy5wb3J0O1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYy5sb2dnZXJQb3J0KSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkUG9ydChjLmxvZ2dlclBvcnQpKSB7XG4gICAgICAgIHRoaXMubG9nZ2VyUG9ydCA9IGMubG9nZ2VyUG9ydDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLnN0YXJ0TG9naWMgPSB0aGlzLnN0YXJ0TG9naWMuYmluZCh0aGlzKTtcbiAgICB0aGlzLmdldEhvb2sgPSB0aGlzLmdldEhvb2suYmluZCh0aGlzKTtcbiAgfVxuXG4gIHByaXZhdGUgaXNWYWxpZFBvcnQgPSAocG9ydDogbnVtYmVyKSA9PiB7XG4gICAgaWYgKHBvcnQgPCAxMDI0KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBzcGVjaWZ5IHBvcnQgKCR7cG9ydH0pIGJlbG93IDEwMjQsIGFzIHRoZXkgYXJlIHByaXZpbGVnZWRgKTtcbiAgICB9IGVsc2UgaWYgKHBvcnQgPiA2NTUzNSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBQb3J0IHNwZWNpZmllZCAoJHtwb3J0fSkgaXMgbm90IGEgdmFsaWQgVENQIHBvcnQuYCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfTtcblxuICBleGl0SGFuZGxlciA9IChvcHRpb25zOiB7IGNsZWFudXA/OiBib29sZWFuOyBleGl0PzogYm9vbGVhbiB9LCBlcnI/OiBFcnJvcik6IHZvaWQgPT4ge1xuICAgIGQoJ2hhbmRsaW5nIHByb2Nlc3MgZXhpdCB3aXRoOicsIG9wdGlvbnMpO1xuICAgIGlmIChvcHRpb25zLmNsZWFudXApIHtcbiAgICAgIGZvciAoY29uc3Qgd2F0Y2hlciBvZiB0aGlzLndhdGNoZXJzKSB7XG4gICAgICAgIGQoJ2NsZWFuaW5nIHdlYnBhY2sgd2F0Y2hlcicpO1xuICAgICAgICB3YXRjaGVyLmNsb3NlKCgpID0+IHtcbiAgICAgICAgICAvKiBEbyBub3RoaW5nIHdoZW4gdGhlIHdhdGNoZXIgY2xvc2VzICovXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgdGhpcy53YXRjaGVycyA9IFtdO1xuICAgICAgZm9yIChjb25zdCBzZXJ2ZXIgb2YgdGhpcy5zZXJ2ZXJzKSB7XG4gICAgICAgIGQoJ2NsZWFuaW5nIGh0dHAgc2VydmVyJyk7XG4gICAgICAgIHNlcnZlci5jbG9zZSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5zZXJ2ZXJzID0gW107XG4gICAgICBmb3IgKGNvbnN0IGxvZ2dlciBvZiB0aGlzLmxvZ2dlcnMpIHtcbiAgICAgICAgZCgnc3RvcHBpbmcgbG9nZ2VyJyk7XG4gICAgICAgIGxvZ2dlci5zdG9wKCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvZ2dlcnMgPSBbXTtcbiAgICB9XG4gICAgaWYgKGVycikgY29uc29sZS5lcnJvcihlcnIuc3RhY2spO1xuICAgIC8vIFdoeTogVGhpcyBpcyBsaXRlcmFsbHkgd2hhdCB0aGUgb3B0aW9uIHNheXMgdG8gZG8uXG4gICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXByb2Nlc3MtZXhpdFxuICAgIGlmIChvcHRpb25zLmV4aXQpIHByb2Nlc3MuZXhpdCgpO1xuICB9O1xuXG4gIGFzeW5jIHdyaXRlSlNPTlN0YXRzKHR5cGU6IHN0cmluZywgc3RhdHM6IHdlYnBhY2suU3RhdHMgfCB1bmRlZmluZWQsIHN0YXRzT3B0aW9uczogV2VicGFja1RvSnNvbk9wdGlvbnMsIHN1ZmZpeDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgaWYgKCFzdGF0cykgcmV0dXJuO1xuICAgIGQoYFdyaXRpbmcgSlNPTiBzdGF0cyBmb3IgJHt0eXBlfSBjb25maWdgKTtcbiAgICBjb25zdCBqc29uU3RhdHMgPSBzdGF0cy50b0pzb24oc3RhdHNPcHRpb25zKTtcbiAgICBjb25zdCBqc29uU3RhdHNGaWxlbmFtZSA9IHBhdGgucmVzb2x2ZSh0aGlzLmJhc2VEaXIsIHR5cGUsIGBzdGF0cy0ke3N1ZmZpeH0uanNvbmApO1xuICAgIGF3YWl0IGZzLndyaXRlSnNvbihqc29uU3RhdHNGaWxlbmFtZSwganNvblN0YXRzLCB7IHNwYWNlczogMiB9KTtcbiAgfVxuXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBtYXgtbGVuXG4gIHByaXZhdGUgcnVuV2VicGFjayA9IGFzeW5jIChvcHRpb25zOiBDb25maWd1cmF0aW9uW10sIGlzUmVuZGVyZXIgPSBmYWxzZSk6IFByb21pc2U8d2VicGFjay5NdWx0aVN0YXRzIHwgdW5kZWZpbmVkPiA9PlxuICAgIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHdlYnBhY2sob3B0aW9ucykucnVuKGFzeW5jIChlcnIsIHN0YXRzKSA9PiB7XG4gICAgICAgIGlmIChpc1JlbmRlcmVyICYmIHRoaXMuY29uZmlnLnJlbmRlcmVyLmpzb25TdGF0cykge1xuICAgICAgICAgIGZvciAoY29uc3QgW2luZGV4LCBlbnRyeVN0YXRzXSBvZiAoc3RhdHM/LnN0YXRzID8/IFtdKS5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIGNvbnN0IG5hbWUgPSB0aGlzLmNvbmZpZy5yZW5kZXJlci5lbnRyeVBvaW50c1tpbmRleF0ubmFtZTtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMud3JpdGVKU09OU3RhdHMoJ3JlbmRlcmVyJywgZW50cnlTdGF0cywgb3B0aW9uc1tpbmRleF0uc3RhdHMgYXMgV2VicGFja1RvSnNvbk9wdGlvbnMsIG5hbWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZXNvbHZlKHN0YXRzKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gIGluaXQgPSAoZGlyOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICB0aGlzLnNldERpcmVjdG9yaWVzKGRpcik7XG5cbiAgICBkKCdob29raW5nIHByb2Nlc3MgZXZlbnRzJyk7XG4gICAgcHJvY2Vzcy5vbignZXhpdCcsIChfY29kZSkgPT4gdGhpcy5leGl0SGFuZGxlcih7IGNsZWFudXA6IHRydWUgfSkpO1xuICAgIHByb2Nlc3Mub24oJ1NJR0lOVCcgYXMgTm9kZUpTLlNpZ25hbHMsIChfc2lnbmFsKSA9PiB0aGlzLmV4aXRIYW5kbGVyKHsgZXhpdDogdHJ1ZSB9KSk7XG4gIH07XG5cbiAgc2V0RGlyZWN0b3JpZXMgPSAoZGlyOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICB0aGlzLnByb2plY3REaXIgPSBkaXI7XG4gICAgdGhpcy5iYXNlRGlyID0gcGF0aC5yZXNvbHZlKGRpciwgJy53ZWJwYWNrJyk7XG4gIH07XG5cbiAgZ2V0IGNvbmZpZ0dlbmVyYXRvcigpOiBXZWJwYWNrQ29uZmlnR2VuZXJhdG9yIHtcbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW5kZXJzY29yZS1kYW5nbGVcbiAgICBpZiAoIXRoaXMuX2NvbmZpZ0dlbmVyYXRvcikge1xuICAgICAgLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLXVuZGVyc2NvcmUtZGFuZ2xlXG4gICAgICB0aGlzLl9jb25maWdHZW5lcmF0b3IgPSBuZXcgV2VicGFja0NvbmZpZ0dlbmVyYXRvcih0aGlzLmNvbmZpZywgdGhpcy5wcm9qZWN0RGlyLCB0aGlzLmlzUHJvZCwgdGhpcy5wb3J0KTtcbiAgICB9XG5cbiAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW5kZXJzY29yZS1kYW5nbGVcbiAgICByZXR1cm4gdGhpcy5fY29uZmlnR2VuZXJhdG9yO1xuICB9XG5cbiAgcHJpdmF0ZSBsb2dnZWRPdXRwdXRVcmwgPSBmYWxzZTtcblxuICBnZXRIb29rKG5hbWU6IHN0cmluZyk6IEZvcmdlSG9va0ZuIHwgbnVsbCB7XG4gICAgc3dpdGNoIChuYW1lKSB7XG4gICAgICBjYXNlICdwcmVQYWNrYWdlJzpcbiAgICAgICAgdGhpcy5pc1Byb2QgPSB0cnVlO1xuICAgICAgICByZXR1cm4gYXN5bmMgKGNvbmZpZzogRm9yZ2VDb25maWcsIHBsYXRmb3JtOiBGb3JnZVBsYXRmb3JtLCBhcmNoOiBGb3JnZUFyY2gpID0+IHtcbiAgICAgICAgICBhd2FpdCBmcy5yZW1vdmUodGhpcy5iYXNlRGlyKTtcbiAgICAgICAgICBhd2FpdCB1dGlscy5yZWJ1aWxkSG9vayhcbiAgICAgICAgICAgIHRoaXMucHJvamVjdERpcixcbiAgICAgICAgICAgIGF3YWl0IHV0aWxzLmdldEVsZWN0cm9uVmVyc2lvbih0aGlzLnByb2plY3REaXIsIGF3YWl0IGZzLnJlYWRKc29uKHBhdGguam9pbih0aGlzLnByb2plY3REaXIsICdwYWNrYWdlLmpzb24nKSkpLFxuICAgICAgICAgICAgcGxhdGZvcm0sXG4gICAgICAgICAgICBhcmNoLFxuICAgICAgICAgICAgY29uZmlnLmVsZWN0cm9uUmVidWlsZENvbmZpZ1xuICAgICAgICAgICk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5jb21waWxlTWFpbigpO1xuICAgICAgICAgIGF3YWl0IHRoaXMuY29tcGlsZVJlbmRlcmVycygpO1xuICAgICAgICB9O1xuICAgICAgY2FzZSAncG9zdFN0YXJ0JzpcbiAgICAgICAgcmV0dXJuIGFzeW5jIChfY29uZmlnOiBGb3JnZUNvbmZpZywgY2hpbGQ6IEVsZWN0cm9uUHJvY2VzcykgPT4ge1xuICAgICAgICAgIGlmICghdGhpcy5sb2dnZWRPdXRwdXRVcmwpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuaW5mbyhgXFxuXFxuV2VicGFjayBPdXRwdXQgQXZhaWxhYmxlOiAke2NoYWxrLmN5YW4oYGh0dHA6Ly9sb2NhbGhvc3Q6JHt0aGlzLmxvZ2dlclBvcnR9YCl9XFxuYCk7XG4gICAgICAgICAgICB0aGlzLmxvZ2dlZE91dHB1dFVybCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGQoJ2hvb2tpbmcgZWxlY3Ryb24gcHJvY2VzcyBleGl0Jyk7XG4gICAgICAgICAgY2hpbGQub24oJ2V4aXQnLCAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoY2hpbGQucmVzdGFydGVkKSByZXR1cm47XG4gICAgICAgICAgICB0aGlzLmV4aXRIYW5kbGVyKHsgY2xlYW51cDogdHJ1ZSwgZXhpdDogdHJ1ZSB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfTtcbiAgICAgIGNhc2UgJ3Jlc29sdmVGb3JnZUNvbmZpZyc6XG4gICAgICAgIHJldHVybiB0aGlzLnJlc29sdmVGb3JnZUNvbmZpZztcbiAgICAgIGNhc2UgJ3BhY2thZ2VBZnRlckNvcHknOlxuICAgICAgICByZXR1cm4gdGhpcy5wYWNrYWdlQWZ0ZXJDb3B5O1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICB9XG5cbiAgcmVzb2x2ZUZvcmdlQ29uZmlnID0gYXN5bmMgKGZvcmdlQ29uZmlnOiBGb3JnZUNvbmZpZyk6IFByb21pc2U8Rm9yZ2VDb25maWc+ID0+IHtcbiAgICBpZiAoIWZvcmdlQ29uZmlnLnBhY2thZ2VyQ29uZmlnKSB7XG4gICAgICBmb3JnZUNvbmZpZy5wYWNrYWdlckNvbmZpZyA9IHt9O1xuICAgIH1cbiAgICBpZiAoZm9yZ2VDb25maWcucGFja2FnZXJDb25maWcuaWdub3JlKSB7XG4gICAgICBpZiAodHlwZW9mIGZvcmdlQ29uZmlnLnBhY2thZ2VyQ29uZmlnLmlnbm9yZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIGNoYWxrLnJlZChgWW91IGhhdmUgc2V0IHBhY2thZ2VyQ29uZmlnLmlnbm9yZSwgdGhlIEVsZWN0cm9uIEZvcmdlIHdlYnBhY2sgcGx1Z2luIG5vcm1hbGx5IHNldHMgdGhpcyBhdXRvbWF0aWNhbGx5LlxuXG5Zb3VyIHBhY2thZ2VkIGFwcCBtYXkgYmUgbGFyZ2VyIHRoYW4gZXhwZWN0ZWQgaWYgeW91IGRvbnQgaWdub3JlIGV2ZXJ5dGhpbmcgb3RoZXIgdGhhbiB0aGUgJy53ZWJwYWNrJyBmb2xkZXJgKVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZvcmdlQ29uZmlnO1xuICAgIH1cbiAgICBmb3JnZUNvbmZpZy5wYWNrYWdlckNvbmZpZy5pZ25vcmUgPSAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgICBpZiAoIWZpbGUpIHJldHVybiBmYWxzZTtcblxuICAgICAgaWYgKHRoaXMuY29uZmlnLmpzb25TdGF0cyAmJiBmaWxlLmVuZHNXaXRoKHBhdGguam9pbignLndlYnBhY2snLCAnbWFpbicsICdzdGF0cy5qc29uJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5jb25maWcucmVuZGVyZXIuanNvblN0YXRzICYmIGZpbGUuZW5kc1dpdGgocGF0aC5qb2luKCcud2VicGFjaycsICdyZW5kZXJlcicsICdzdGF0cy5qc29uJykpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuXG4gICAgICBpZiAoIXRoaXMuY29uZmlnLnBhY2thZ2VTb3VyY2VNYXBzICYmIC9bXi9cXFxcXStcXC5qc1xcLm1hcCQvLnRlc3QoZmlsZSkpIHtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAhL15bL1xcXFxdXFwud2VicGFjaygkfFsvXFxcXF0pLiokLy50ZXN0KGZpbGUpO1xuICAgIH07XG4gICAgcmV0dXJuIGZvcmdlQ29uZmlnO1xuICB9O1xuXG4gIHBhY2thZ2VBZnRlckNvcHkgPSBhc3luYyAoX2ZvcmdlQ29uZmlnOiBGb3JnZUNvbmZpZywgYnVpbGRQYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBjb25zdCBwaiA9IGF3YWl0IGZzLnJlYWRKc29uKHBhdGgucmVzb2x2ZSh0aGlzLnByb2plY3REaXIsICdwYWNrYWdlLmpzb24nKSk7XG5cbiAgICBpZiAoIXBqLm1haW4/LmVuZHNXaXRoKCcud2VicGFjay9tYWluJykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRWxlY3Ryb24gRm9yZ2UgaXMgY29uZmlndXJlZCB0byB1c2UgdGhlIFdlYnBhY2sgcGx1Z2luLiBUaGUgcGx1Z2luIGV4cGVjdHMgdGhlXG5cIm1haW5cIiBlbnRyeSBwb2ludCBpbiBcInBhY2thZ2UuanNvblwiIHRvIGJlIFwiLndlYnBhY2svbWFpblwiICh3aGVyZSB0aGUgcGx1Z2luIG91dHB1dHNcbnRoZSBnZW5lcmF0ZWQgZmlsZXMpLiBJbnN0ZWFkLCBpdCBpcyAke0pTT04uc3RyaW5naWZ5KHBqLm1haW4pfWApO1xuICAgIH1cblxuICAgIGlmIChwai5jb25maWcpIHtcbiAgICAgIGRlbGV0ZSBwai5jb25maWcuZm9yZ2U7XG4gICAgfVxuICAgIHBqLmRldkRlcGVuZGVuY2llcyA9IHt9O1xuICAgIHBqLmRlcGVuZGVuY2llcyA9IHt9O1xuICAgIHBqLm9wdGlvbmFsRGVwZW5kZW5jaWVzID0ge307XG4gICAgcGoucGVlckRlcGVuZGVuY2llcyA9IHt9O1xuXG4gICAgYXdhaXQgZnMud3JpdGVKc29uKHBhdGgucmVzb2x2ZShidWlsZFBhdGgsICdwYWNrYWdlLmpzb24nKSwgcGosIHtcbiAgICAgIHNwYWNlczogMixcbiAgICB9KTtcblxuICAgIGF3YWl0IGZzLm1rZGlycChwYXRoLnJlc29sdmUoYnVpbGRQYXRoLCAnbm9kZV9tb2R1bGVzJykpO1xuICB9O1xuXG4gIGNvbXBpbGVNYWluID0gYXN5bmMgKHdhdGNoID0gZmFsc2UsIGxvZ2dlcj86IExvZ2dlcik6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgIGxldCB0YWI6IFRhYjtcbiAgICBpZiAobG9nZ2VyKSB7XG4gICAgICB0YWIgPSBsb2dnZXIuY3JlYXRlVGFiKCdNYWluIFByb2Nlc3MnKTtcbiAgICB9XG4gICAgYXdhaXQgYXN5bmNPcmEoJ0NvbXBpbGluZyBNYWluIFByb2Nlc3MgQ29kZScsIGFzeW5jICgpID0+IHtcbiAgICAgIGNvbnN0IG1haW5Db25maWcgPSBhd2FpdCB0aGlzLmNvbmZpZ0dlbmVyYXRvci5nZXRNYWluQ29uZmlnKCk7XG4gICAgICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGNvbnN0IGNvbXBpbGVyID0gd2VicGFjayhtYWluQ29uZmlnKTtcbiAgICAgICAgY29uc3QgW29uY2VSZXNvbHZlLCBvbmNlUmVqZWN0XSA9IG9uY2UocmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgY29uc3QgY2I6IFdlYnBhY2tXYXRjaEhhbmRsZXIgPSBhc3luYyAoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgICAgIGlmICh0YWIgJiYgc3RhdHMpIHtcbiAgICAgICAgICAgIHRhYi5sb2coXG4gICAgICAgICAgICAgIHN0YXRzLnRvU3RyaW5nKHtcbiAgICAgICAgICAgICAgICBjb2xvcnM6IHRydWUsXG4gICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAodGhpcy5jb25maWcuanNvblN0YXRzKSB7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLndyaXRlSlNPTlN0YXRzKCdtYWluJywgc3RhdHMsIG1haW5Db25maWcuc3RhdHMgYXMgV2VicGFja1RvSnNvbk9wdGlvbnMsICdtYWluJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGVycikgcmV0dXJuIG9uY2VSZWplY3QoZXJyKTtcbiAgICAgICAgICBpZiAoIXdhdGNoICYmIHN0YXRzPy5oYXNFcnJvcnMoKSkge1xuICAgICAgICAgICAgcmV0dXJuIG9uY2VSZWplY3QobmV3IEVycm9yKGBDb21waWxhdGlvbiBlcnJvcnMgaW4gdGhlIG1haW4gcHJvY2VzczogJHtzdGF0cy50b1N0cmluZygpfWApKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gb25jZVJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgICAgfTtcbiAgICAgICAgaWYgKHdhdGNoKSB7XG4gICAgICAgICAgdGhpcy53YXRjaGVycy5wdXNoKGNvbXBpbGVyLndhdGNoKHt9LCBjYikpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbXBpbGVyLnJ1bihjYik7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbXBpbGVSZW5kZXJlcnMgPSBhc3luYyAod2F0Y2ggPSBmYWxzZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgIGF3YWl0IGFzeW5jT3JhKCdDb21waWxpbmcgUmVuZGVyZXIgVGVtcGxhdGUnLCBhc3luYyAoKSA9PiB7XG4gICAgICBjb25zdCBzdGF0cyA9IGF3YWl0IHRoaXMucnVuV2VicGFjayhhd2FpdCB0aGlzLmNvbmZpZ0dlbmVyYXRvci5nZXRSZW5kZXJlckNvbmZpZyh0aGlzLmNvbmZpZy5yZW5kZXJlci5lbnRyeVBvaW50cyksIHRydWUpO1xuICAgICAgaWYgKCF3YXRjaCAmJiBzdGF0cz8uaGFzRXJyb3JzKCkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb21waWxhdGlvbiBlcnJvcnMgaW4gdGhlIHJlbmRlcmVyOiAke3N0YXRzLnRvU3RyaW5nKCl9YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBmb3IgKGNvbnN0IGVudHJ5UG9pbnQgb2YgdGhpcy5jb25maWcucmVuZGVyZXIuZW50cnlQb2ludHMpIHtcbiAgICAgIGlmIChlbnRyeVBvaW50LnByZWxvYWQpIHtcbiAgICAgICAgYXdhaXQgYXN5bmNPcmEoYENvbXBpbGluZyBSZW5kZXJlciBQcmVsb2FkOiAke2NoYWxrLmN5YW4oZW50cnlQb2ludC5uYW1lKX1gLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLnJ1bldlYnBhY2soXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgW2F3YWl0IHRoaXMuY29uZmlnR2VuZXJhdG9yLmdldFByZWxvYWRDb25maWdGb3JFbnRyeVBvaW50KGVudHJ5UG9pbnQsIGVudHJ5UG9pbnQucHJlbG9hZCEpXVxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAoc3RhdHM/Lmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGF0aW9uIGVycm9ycyBpbiB0aGUgcHJlbG9hZCAoJHtlbnRyeVBvaW50Lm5hbWV9KTogJHtzdGF0cy50b1N0cmluZygpfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5jb25maWcucmVuZGVyZXIucHJlbG9hZEVudHJpZXMpKSB7XG4gICAgICBmb3IgKGNvbnN0IHByZWxvYWQgb2YgdGhpcy5jb25maWcucmVuZGVyZXIucHJlbG9hZEVudHJpZXMpIHtcbiAgICAgICAgYXdhaXQgYXN5bmNPcmEoYENvbXBpbGluZyBFeHRyYSBQcmVsb2FkIFNjcmlwdHNgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLnJ1bldlYnBhY2soXG4gICAgICAgICAgICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLW5vbi1udWxsLWFzc2VydGlvblxuICAgICAgICAgICAgW2F3YWl0IHRoaXMuY29uZmlnR2VuZXJhdG9yLmdldFN0YW5kYWxvbmVQcmVsb2FkQ29uZmlnKHByZWxvYWQpXVxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAoc3RhdHM/Lmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYENvbXBpbGF0aW9uIGVycm9ycyBpbiB0aGUgcHJlbG9hZCk6ICR7c3RhdHMudG9TdHJpbmcoKX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBsYXVuY2hEZXZTZXJ2ZXJzID0gYXN5bmMgKGxvZ2dlcjogTG9nZ2VyKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgYXdhaXQgYXN5bmNPcmEoJ0xhdW5jaGluZyBEZXYgU2VydmVycyBmb3IgUmVuZGVyZXIgUHJvY2VzcyBDb2RlJywgYXN5bmMgKCkgPT4ge1xuICAgICAgY29uc3QgdGFiID0gbG9nZ2VyLmNyZWF0ZVRhYignUmVuZGVyZXJzJyk7XG4gICAgICBjb25zdCBwbHVnaW5Mb2dzID0gbmV3IEVsZWN0cm9uRm9yZ2VMb2dnaW5nUGx1Z2luKHRhYik7XG5cbiAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHRoaXMuY29uZmlnR2VuZXJhdG9yLmdldFJlbmRlcmVyQ29uZmlnKHRoaXMuY29uZmlnLnJlbmRlcmVyLmVudHJ5UG9pbnRzKTtcbiAgICAgIGlmIChjb25maWcubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBlbnRyeUNvbmZpZyBvZiBjb25maWcpIHtcbiAgICAgICAgaWYgKCFlbnRyeUNvbmZpZy5wbHVnaW5zKSBlbnRyeUNvbmZpZy5wbHVnaW5zID0gW107XG4gICAgICAgIGVudHJ5Q29uZmlnLnBsdWdpbnMucHVzaChwbHVnaW5Mb2dzKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgY29tcGlsZXIgPSB3ZWJwYWNrKGNvbmZpZyk7XG4gICAgICBjb25zdCB3ZWJwYWNrRGV2U2VydmVyID0gbmV3IFdlYnBhY2tEZXZTZXJ2ZXIodGhpcy5kZXZTZXJ2ZXJPcHRpb25zKCksIGNvbXBpbGVyKTtcbiAgICAgIGF3YWl0IHdlYnBhY2tEZXZTZXJ2ZXIuc3RhcnQoKTtcbiAgICAgIHRoaXMuc2VydmVycy5wdXNoKHdlYnBhY2tEZXZTZXJ2ZXIuc2VydmVyKTtcbiAgICB9KTtcblxuICAgIGF3YWl0IGFzeW5jT3JhKCdDb21waWxpbmcgUHJlbG9hZCBTY3JpcHRzJywgYXN5bmMgKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIHRoaXMuY29uZmlnLnJlbmRlcmVyLmVudHJ5UG9pbnRzKSB7XG4gICAgICAgIGlmIChlbnRyeVBvaW50LnByZWxvYWQpIHtcbiAgICAgICAgICBjb25zdCBjb25maWcgPSBhd2FpdCB0aGlzLmNvbmZpZ0dlbmVyYXRvci5nZXRQcmVsb2FkQ29uZmlnRm9yRW50cnlQb2ludChlbnRyeVBvaW50LCBlbnRyeVBvaW50LnByZWxvYWQpO1xuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhYiA9IGxvZ2dlci5jcmVhdGVUYWIoYCR7ZW50cnlQb2ludC5uYW1lfSAtIFByZWxvYWRgKTtcbiAgICAgICAgICAgIGNvbnN0IFtvbmNlUmVzb2x2ZSwgb25jZVJlamVjdF0gPSBvbmNlKHJlc29sdmUsIHJlamVjdCk7XG5cbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChcbiAgICAgICAgICAgICAgd2VicGFjayhjb25maWcpLndhdGNoKHt9LCAoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0cykge1xuICAgICAgICAgICAgICAgICAgdGFiLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMudG9TdHJpbmcoe1xuICAgICAgICAgICAgICAgICAgICAgIGNvbG9yczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIG9uY2VSZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25jZVJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodGhpcy5jb25maWcucmVuZGVyZXIucHJlbG9hZEVudHJpZXMpKSB7XG4gICAgICAgIGZvciAoY29uc3QgcHJlbG9hZCBvZiB0aGlzLmNvbmZpZy5yZW5kZXJlci5wcmVsb2FkRW50cmllcykge1xuICAgICAgICAgIGNvbnN0IGNvbmZpZyA9IGF3YWl0IHRoaXMuY29uZmlnR2VuZXJhdG9yLmdldFN0YW5kYWxvbmVQcmVsb2FkQ29uZmlnKHByZWxvYWQpO1xuICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHRhYiA9IGxvZ2dlci5jcmVhdGVUYWIoYEFBQUFBQUFBQUFBQUFgKTtcbiAgICAgICAgICAgIGNvbnN0IFtvbmNlUmVzb2x2ZSwgb25jZVJlamVjdF0gPSBvbmNlKHJlc29sdmUsIHJlamVjdCk7XG5cbiAgICAgICAgICAgIHRoaXMud2F0Y2hlcnMucHVzaChcbiAgICAgICAgICAgICAgd2VicGFjayhjb25maWcpLndhdGNoKHt9LCAoZXJyLCBzdGF0cykgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChzdGF0cykge1xuICAgICAgICAgICAgICAgICAgdGFiLmxvZyhcbiAgICAgICAgICAgICAgICAgICAgc3RhdHMudG9TdHJpbmcoe1xuICAgICAgICAgICAgICAgICAgICAgIGNvbG9yczogdHJ1ZSxcbiAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgaWYgKGVycikgcmV0dXJuIG9uY2VSZWplY3QoZXJyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gb25jZVJlc29sdmUodW5kZWZpbmVkKTtcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfTtcblxuICBkZXZTZXJ2ZXJPcHRpb25zKCk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgICBjb25zdCBjc3BEaXJlY3RpdmVzID1cbiAgICAgIHRoaXMuY29uZmlnLmRldkNvbnRlbnRTZWN1cml0eVBvbGljeSA/PyBcImRlZmF1bHQtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgZGF0YTo7IHNjcmlwdC1zcmMgJ3NlbGYnICd1bnNhZmUtZXZhbCcgJ3Vuc2FmZS1pbmxpbmUnIGRhdGE6XCI7XG5cbiAgICBjb25zdCBkZWZhdWx0cyA9IHtcbiAgICAgIGhvdDogdHJ1ZSxcbiAgICAgIGRldk1pZGRsZXdhcmU6IHtcbiAgICAgICAgd3JpdGVUb0Rpc2s6IHRydWUsXG4gICAgICB9LFxuICAgICAgaGlzdG9yeUFwaUZhbGxiYWNrOiB0cnVlLFxuICAgIH07XG4gICAgY29uc3Qgb3ZlcnJpZGVzID0ge1xuICAgICAgcG9ydDogdGhpcy5wb3J0LFxuICAgICAgc2V0dXBFeGl0U2lnbmFsczogdHJ1ZSxcbiAgICAgIHN0YXRpYzogcGF0aC5yZXNvbHZlKHRoaXMuYmFzZURpciwgJ3JlbmRlcmVyJyksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdDb250ZW50LVNlY3VyaXR5LVBvbGljeSc6IGNzcERpcmVjdGl2ZXMsXG4gICAgICB9LFxuICAgIH07XG5cbiAgICByZXR1cm4gbWVyZ2UoZGVmYXVsdHMsIHRoaXMuY29uZmlnLmRldlNlcnZlciA/PyB7fSwgb3ZlcnJpZGVzKTtcbiAgfVxuXG4gIHByaXZhdGUgYWxyZWFkeVN0YXJ0ZWQgPSBmYWxzZTtcblxuICBhc3luYyBzdGFydExvZ2ljKCk6IFByb21pc2U8ZmFsc2U+IHtcbiAgICBpZiAodGhpcy5hbHJlYWR5U3RhcnRlZCkgcmV0dXJuIGZhbHNlO1xuICAgIHRoaXMuYWxyZWFkeVN0YXJ0ZWQgPSB0cnVlO1xuXG4gICAgYXdhaXQgZnMucmVtb3ZlKHRoaXMuYmFzZURpcik7XG5cbiAgICBjb25zdCBsb2dnZXIgPSBuZXcgTG9nZ2VyKHRoaXMubG9nZ2VyUG9ydCk7XG4gICAgdGhpcy5sb2dnZXJzLnB1c2gobG9nZ2VyKTtcbiAgICBhd2FpdCB0aGlzLmNvbXBpbGVNYWluKHRydWUsIGxvZ2dlcik7XG4gICAgYXdhaXQgdGhpcy5sYXVuY2hEZXZTZXJ2ZXJzKGxvZ2dlcik7XG4gICAgYXdhaXQgbG9nZ2VyLnN0YXJ0KCk7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydCB7IFdlYnBhY2tQbHVnaW5Db25maWcgfTtcbiJdLCJuYW1lcyI6WyJXZWJwYWNrUGx1Z2luQ29uZmlnIiwiZCIsImRlYnVnIiwiREVGQVVMVF9QT1JUIiwiREVGQVVMVF9MT0dHRVJfUE9SVCIsIldlYnBhY2tQbHVnaW4iLCJQbHVnaW5CYXNlIiwiYyIsIm5hbWUiLCJpc1Byb2QiLCJ3YXRjaGVycyIsInNlcnZlcnMiLCJsb2dnZXJzIiwicG9ydCIsImxvZ2dlclBvcnQiLCJpc1ZhbGlkUG9ydCIsIkVycm9yIiwiZXhpdEhhbmRsZXIiLCJvcHRpb25zIiwiZXJyIiwiY2xlYW51cCIsIndhdGNoZXIiLCJjbG9zZSIsInNlcnZlciIsImxvZ2dlciIsInN0b3AiLCJjb25zb2xlIiwiZXJyb3IiLCJzdGFjayIsImV4aXQiLCJwcm9jZXNzIiwicnVuV2VicGFjayIsImlzUmVuZGVyZXIiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIndlYnBhY2siLCJydW4iLCJzdGF0cyIsImNvbmZpZyIsInJlbmRlcmVyIiwianNvblN0YXRzIiwiaW5kZXgiLCJlbnRyeVN0YXRzIiwiZW50cmllcyIsImVudHJ5UG9pbnRzIiwid3JpdGVKU09OU3RhdHMiLCJpbml0IiwiZGlyIiwic2V0RGlyZWN0b3JpZXMiLCJvbiIsIl9jb2RlIiwiX3NpZ25hbCIsInByb2plY3REaXIiLCJiYXNlRGlyIiwicGF0aCIsImxvZ2dlZE91dHB1dFVybCIsInJlc29sdmVGb3JnZUNvbmZpZyIsImZvcmdlQ29uZmlnIiwicGFja2FnZXJDb25maWciLCJpZ25vcmUiLCJjaGFsayIsInJlZCIsImZpbGUiLCJlbmRzV2l0aCIsImpvaW4iLCJwYWNrYWdlU291cmNlTWFwcyIsInRlc3QiLCJwYWNrYWdlQWZ0ZXJDb3B5IiwiX2ZvcmdlQ29uZmlnIiwiYnVpbGRQYXRoIiwicGoiLCJmcyIsInJlYWRKc29uIiwibWFpbiIsIkpTT04iLCJzdHJpbmdpZnkiLCJmb3JnZSIsImRldkRlcGVuZGVuY2llcyIsImRlcGVuZGVuY2llcyIsIm9wdGlvbmFsRGVwZW5kZW5jaWVzIiwicGVlckRlcGVuZGVuY2llcyIsIndyaXRlSnNvbiIsInNwYWNlcyIsIm1rZGlycCIsImNvbXBpbGVNYWluIiwid2F0Y2giLCJ0YWIiLCJjcmVhdGVUYWIiLCJhc3luY09yYSIsIm1haW5Db25maWciLCJjb25maWdHZW5lcmF0b3IiLCJnZXRNYWluQ29uZmlnIiwiY29tcGlsZXIiLCJvbmNlUmVzb2x2ZSIsIm9uY2VSZWplY3QiLCJvbmNlIiwiY2IiLCJsb2ciLCJ0b1N0cmluZyIsImNvbG9ycyIsImhhc0Vycm9ycyIsInVuZGVmaW5lZCIsInB1c2giLCJjb21waWxlUmVuZGVyZXJzIiwiZ2V0UmVuZGVyZXJDb25maWciLCJlbnRyeVBvaW50IiwicHJlbG9hZCIsImN5YW4iLCJnZXRQcmVsb2FkQ29uZmlnRm9yRW50cnlQb2ludCIsIkFycmF5IiwiaXNBcnJheSIsInByZWxvYWRFbnRyaWVzIiwiZ2V0U3RhbmRhbG9uZVByZWxvYWRDb25maWciLCJsYXVuY2hEZXZTZXJ2ZXJzIiwicGx1Z2luTG9ncyIsIkVsZWN0cm9uRm9yZ2VMb2dnaW5nUGx1Z2luIiwibGVuZ3RoIiwiZW50cnlDb25maWciLCJwbHVnaW5zIiwid2VicGFja0RldlNlcnZlciIsIldlYnBhY2tEZXZTZXJ2ZXIiLCJkZXZTZXJ2ZXJPcHRpb25zIiwic3RhcnQiLCJhbHJlYWR5U3RhcnRlZCIsInN0YXJ0TG9naWMiLCJiaW5kIiwiZ2V0SG9vayIsInR5cGUiLCJzdGF0c09wdGlvbnMiLCJzdWZmaXgiLCJ0b0pzb24iLCJqc29uU3RhdHNGaWxlbmFtZSIsIl9jb25maWdHZW5lcmF0b3IiLCJXZWJwYWNrQ29uZmlnR2VuZXJhdG9yIiwicGxhdGZvcm0iLCJhcmNoIiwicmVtb3ZlIiwidXRpbHMiLCJyZWJ1aWxkSG9vayIsImdldEVsZWN0cm9uVmVyc2lvbiIsImVsZWN0cm9uUmVidWlsZENvbmZpZyIsIl9jb25maWciLCJjaGlsZCIsImluZm8iLCJyZXN0YXJ0ZWQiLCJjc3BEaXJlY3RpdmVzIiwiZGV2Q29udGVudFNlY3VyaXR5UG9saWN5IiwiZGVmYXVsdHMiLCJob3QiLCJkZXZNaWRkbGV3YXJlIiwid3JpdGVUb0Rpc2siLCJoaXN0b3J5QXBpRmFsbGJhY2siLCJvdmVycmlkZXMiLCJzZXR1cEV4aXRTaWduYWxzIiwic3RhdGljIiwiaGVhZGVycyIsIm1lcmdlIiwiZGV2U2VydmVyIiwiTG9nZ2VyIl0sIm1hcHBpbmdzIjoiOzs7OytCQTJiU0EsQ0FBbUI7OztlQUFuQkEsT0FBbUI7Ozs7QUExYkgsR0FBMkIsQ0FBM0IsU0FBMkI7QUFDN0IsR0FBNkIsQ0FBN0IsV0FBNkI7QUFFeEIsR0FBa0MsQ0FBbEMsZUFBa0M7QUFFNUMsR0FBTyxDQUFQLE1BQU87QUFDUCxHQUFPLENBQVAsTUFBTztBQUNWLEdBQVUsQ0FBVixRQUFVO0FBRUgsR0FBZSxDQUFmLGFBQWU7QUFDcEIsR0FBTSxDQUFOLEtBQU07QUFDRCxHQUFzQixDQUF0QixLQUFzQjtBQUNLLEdBQVMsQ0FBVCxRQUFTO0FBQzdCLEdBQW9CLENBQXBCLGlCQUFvQjtBQUViLEdBQVUsQ0FBVixPQUFVO0FBQ1AsR0FBNkIsQ0FBN0IscUJBQTZCO0FBQ25ELEdBQWEsQ0FBYixLQUFhO0FBQ0ssR0FBaUIsQ0FBakIsY0FBaUI7Ozs7OztBQUVwRCxLQUFLLENBQUNDLENBQUMsT0FBR0MsTUFBSyxVQUFDLENBQStCO0FBQy9DLEtBQUssQ0FBQ0MsWUFBWSxHQUFHLElBQUk7QUFDekIsS0FBSyxDQUFDQyxtQkFBbUIsR0FBRyxJQUFJO01BS1hDLGFBQWEsU0FBU0MsV0FBVTtnQkF1QnZDQyxDQUFzQixDQUFFLENBQUM7UUFDbkMsS0FBSyxDQUFDQSxDQUFDO1FBeEJJLElBNlpkLENBNVpDQyxJQUFJLEdBQUcsQ0FBUztR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