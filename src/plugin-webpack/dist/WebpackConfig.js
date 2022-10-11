"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
var _debug = _interopRequireDefault(require("debug"));
var _htmlWebpackPlugin = _interopRequireDefault(require("html-webpack-plugin"));
var _path = _interopRequireDefault(require("path"));
var _webpack = _interopRequireDefault(require("webpack"));
var _webpackMerge = require("webpack-merge");
var _assetRelocatorPatch = _interopRequireDefault(require("./util/AssetRelocatorPatch"));
var _processConfig = _interopRequireDefault(require("./util/processConfig"));
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const d = (0, _debug).default('electron-forge:plugin:webpack:webpackconfig');
class WebpackConfigGenerator {
    constructor(pluginConfig, projectDir, isProd, port){
        // Users can override this method in a subclass to provide custom logic or
        // configuration parameters.
        this.preprocessConfig = async (config)=>config({}, {
                mode: this.mode
            })
        ;
        this.pluginConfig = pluginConfig;
        this.projectDir = projectDir;
        this.webpackDir = _path.default.resolve(projectDir, '.webpack');
        this.isProd = isProd;
        this.port = port;
        d('Config mode:', this.mode);
    }
    async resolveConfig(config) {
        const rawConfig = typeof config === 'string' ? require(_path.default.resolve(this.projectDir, config)) : config;
        return (0, _processConfig).default(this.preprocessConfig, rawConfig);
    }
    get mode() {
        return this.isProd ? 'production' : 'development';
    }
    get rendererSourceMapOption() {
        return this.isProd ? 'source-map' : 'eval-source-map';
    }
    rendererTarget(entryPoint) {
        var _nodeIntegration;
        return ((_nodeIntegration = entryPoint.nodeIntegration) !== null && _nodeIntegration !== void 0 ? _nodeIntegration : this.pluginConfig.renderer.nodeIntegration) ? 'electron-renderer' : 'web';
    }
    rendererEntryPoint(entryPoint, inRendererDir, basename) {
        if (this.isProd) {
            return `\`file://$\{require('path').resolve(__dirname, '..', '${inRendererDir ? 'renderer' : '.'}', '${entryPoint.name}', '${basename}')}\``;
        }
        const baseUrl = `http://localhost:${this.port}/${entryPoint.name}`;
        if (basename !== 'index.html') {
            return `'${baseUrl}/${basename}'`;
        }
        return `'${baseUrl}'`;
    }
    toEnvironmentVariable(entryPoint, preload = false) {
        const suffix = preload ? '_PRELOAD_WEBPACK_ENTRY' : '_WEBPACK_ENTRY';
        return `${entryPoint.name.toUpperCase().replace(/ /g, '_')}${suffix}`;
    }
    getPreloadDefine(entryPoint) {
        if (entryPoint.preload) {
            if (this.isProd) {
                return `require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'preload.js')`;
            }
            return `'${_path.default.resolve(this.webpackDir, 'renderer', entryPoint.name, 'preload.js').replace(/\\/g, '\\\\')}'`;
        }
        // If this entry-point has no configured preload script just map this constant to `undefined`
        // so that any code using it still works.  This makes quick-start / docs simpler.
        return 'undefined';
    }
    getStandalonePreloadDefine(entryPoint) {
        if (this.isProd) {
            return `require('path').resolve(__dirname, '../renderer', '${entryPoint.name}', 'preload.js')`;
        } else {
            return `'${_path.default.resolve(this.webpackDir, 'renderer', entryPoint.name, 'preload.js').replace(/\\/g, '\\\\')}'`;
        }
    }
    getDefines(inRendererDir = true) {
        const defines = {};
        if (!this.pluginConfig.renderer.entryPoints || !Array.isArray(this.pluginConfig.renderer.entryPoints)) {
            throw new Error('Required config option "renderer.entryPoints" has not been defined');
        }
        for (const entryPoint of this.pluginConfig.renderer.entryPoints){
            const entryKey = this.toEnvironmentVariable(entryPoint);
            if (entryPoint.html) {
                defines[entryKey] = this.rendererEntryPoint(entryPoint, inRendererDir, 'index.html');
            } else {
                defines[entryKey] = this.rendererEntryPoint(entryPoint, inRendererDir, 'index.js');
            }
            defines[`process.env.${entryKey}`] = defines[entryKey];
            const preloadDefineKey = this.toEnvironmentVariable(entryPoint, true);
            defines[preloadDefineKey] = this.getPreloadDefine(entryPoint);
            defines[`process.env.${preloadDefineKey}`] = defines[preloadDefineKey];
        }
        if (Array.isArray(this.pluginConfig.renderer.preloadEntries)) {
            for (const entryPoint of this.pluginConfig.renderer.preloadEntries){
                const preloadDefineKey = this.toEnvironmentVariable(entryPoint, true);
                defines[preloadDefineKey] = this.getStandalonePreloadDefine(entryPoint);
                defines[`process.env.${preloadDefineKey}`] = defines[preloadDefineKey];
            }
        }
        return defines;
    }
    async getMainConfig() {
        const mainConfig = await this.resolveConfig(this.pluginConfig.mainConfig);
        if (!mainConfig.entry) {
            throw new Error('Required option "mainConfig.entry" has not been defined');
        }
        const fix = (item)=>{
            if (typeof item === 'string') return fix([
                item
            ])[0];
            if (Array.isArray(item)) {
                return item.map((val)=>val.startsWith('./') ? _path.default.resolve(this.projectDir, val) : val
                );
            }
            const ret = {};
            for (const key of Object.keys(item)){
                ret[key] = fix(item[key]);
            }
            return ret;
        };
        mainConfig.entry = fix(mainConfig.entry);
        return (0, _webpackMerge).merge({
            devtool: 'source-map',
            target: 'electron-main',
            mode: this.mode,
            output: {
                path: _path.default.resolve(this.webpackDir, 'main'),
                filename: 'index.js',
                libraryTarget: 'commonjs2'
            },
            plugins: [
                new _webpack.default.DefinePlugin(this.getDefines())
            ],
            node: {
                __dirname: false,
                __filename: false
            }
        }, mainConfig || {});
    }
    async getStandalonePreloadConfig(entryPoint) {
        const rendererConfig = await this.resolveConfig(entryPoint.config || this.pluginConfig.renderer.config);
        const prefixedEntries = entryPoint.prefixedEntries || [];
        return (0, _webpackMerge).merge({
            devtool: this.rendererSourceMapOption,
            mode: this.mode,
            entry: prefixedEntries.concat([
                entryPoint.js
            ]),
            output: {
                path: _path.default.resolve(this.webpackDir, 'renderer', entryPoint.name),
                filename: 'preload.js'
            },
            node: {
                __dirname: false,
                __filename: false
            }
        }, rendererConfig || {}, {
            target: 'electron-preload'
        });
    }
    async getPreloadConfigForEntryPoint(parentPoint, entryPoint) {
        const rendererConfig = await this.resolveConfig(entryPoint.config || this.pluginConfig.renderer.config);
        const prefixedEntries = entryPoint.prefixedEntries || [];
        return (0, _webpackMerge).merge({
            devtool: this.rendererSourceMapOption,
            mode: this.mode,
            entry: prefixedEntries.concat([
                entryPoint.js
            ]),
            output: {
                path: _path.default.resolve(this.webpackDir, 'renderer', parentPoint.name),
                filename: 'preload.js'
            },
            node: {
                __dirname: false,
                __filename: false
            }
        }, rendererConfig || {}, {
            target: 'electron-preload'
        });
    }
    async getRendererConfig(entryPoints) {
        const rendererConfig = await this.resolveConfig(this.pluginConfig.renderer.config);
        const defines = this.getDefines(false);
        return entryPoints.map((entryPoint)=>{
            const config = (0, _webpackMerge).merge({
                entry: {
                    [entryPoint.name]: (entryPoint.prefixedEntries || []).concat([
                        entryPoint.js
                    ])
                },
                target: this.rendererTarget(entryPoint),
                devtool: this.rendererSourceMapOption,
                mode: this.mode,
                output: {
                    path: _path.default.resolve(this.webpackDir, 'renderer'),
                    filename: '[name]/index.js',
                    globalObject: 'self',
                    ...this.isProd ? {} : {
                        publicPath: '/'
                    }
                },
                node: {
                    __dirname: false,
                    __filename: false
                },
                plugins: [
                    ...entryPoint.html ? [
                        new _htmlWebpackPlugin.default({
                            title: entryPoint.name,
                            template: entryPoint.html,
                            filename: `${entryPoint.name}/index.html`,
                            chunks: [
                                entryPoint.name
                            ].concat(entryPoint.additionalChunks || [])
                        }), 
                    ] : [],
                    new _webpack.default.DefinePlugin(defines),
                    new _assetRelocatorPatch.default(this.isProd, !!this.pluginConfig.renderer.nodeIntegration), 
                ]
            }, rendererConfig || {});
            return config;
        });
    }
}
exports.default = WebpackConfigGenerator;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9XZWJwYWNrQ29uZmlnLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBkZWJ1ZyBmcm9tICdkZWJ1Zyc7XG5pbXBvcnQgSHRtbFdlYnBhY2tQbHVnaW4gZnJvbSAnaHRtbC13ZWJwYWNrLXBsdWdpbic7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCB3ZWJwYWNrLCB7IENvbmZpZ3VyYXRpb24sIFdlYnBhY2tQbHVnaW5JbnN0YW5jZSB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IHsgbWVyZ2UgYXMgd2VicGFja01lcmdlIH0gZnJvbSAnd2VicGFjay1tZXJnZSc7XG5pbXBvcnQgeyBXZWJwYWNrUGx1Z2luQ29uZmlnLCBXZWJwYWNrUGx1Z2luRW50cnlQb2ludCwgV2VicGFja1ByZWxvYWRFbnRyeVBvaW50LCBXZWJwYWNrUHJlbG9hZEVudHJ5UG9pbnQyIH0gZnJvbSAnLi9Db25maWcnO1xuaW1wb3J0IEFzc2V0UmVsb2NhdG9yUGF0Y2ggZnJvbSAnLi91dGlsL0Fzc2V0UmVsb2NhdG9yUGF0Y2gnO1xuaW1wb3J0IHByb2Nlc3NDb25maWcgZnJvbSAnLi91dGlsL3Byb2Nlc3NDb25maWcnO1xuXG50eXBlIEVudHJ5VHlwZSA9IHN0cmluZyB8IHN0cmluZ1tdIHwgUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgc3RyaW5nW10+O1xudHlwZSBXZWJwYWNrTW9kZSA9ICdwcm9kdWN0aW9uJyB8ICdkZXZlbG9wbWVudCc7XG5cbmNvbnN0IGQgPSBkZWJ1ZygnZWxlY3Ryb24tZm9yZ2U6cGx1Z2luOndlYnBhY2s6d2VicGFja2NvbmZpZycpO1xuXG5leHBvcnQgdHlwZSBDb25maWd1cmF0aW9uRmFjdG9yeSA9IChcbiAgZW52OiBzdHJpbmcgfCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmcgfCBib29sZWFuIHwgbnVtYmVyPiB8IHVua25vd24sXG4gIGFyZ3M6IFJlY29yZDxzdHJpbmcsIHVua25vd24+XG4pID0+IENvbmZpZ3VyYXRpb24gfCBQcm9taXNlPENvbmZpZ3VyYXRpb24+O1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBXZWJwYWNrQ29uZmlnR2VuZXJhdG9yIHtcbiAgcHJpdmF0ZSBpc1Byb2Q6IGJvb2xlYW47XG5cbiAgcHJpdmF0ZSBwbHVnaW5Db25maWc6IFdlYnBhY2tQbHVnaW5Db25maWc7XG5cbiAgcHJpdmF0ZSBwb3J0OiBudW1iZXI7XG5cbiAgcHJpdmF0ZSBwcm9qZWN0RGlyOiBzdHJpbmc7XG5cbiAgcHJpdmF0ZSB3ZWJwYWNrRGlyOiBzdHJpbmc7XG5cbiAgY29uc3RydWN0b3IocGx1Z2luQ29uZmlnOiBXZWJwYWNrUGx1Z2luQ29uZmlnLCBwcm9qZWN0RGlyOiBzdHJpbmcsIGlzUHJvZDogYm9vbGVhbiwgcG9ydDogbnVtYmVyKSB7XG4gICAgdGhpcy5wbHVnaW5Db25maWcgPSBwbHVnaW5Db25maWc7XG4gICAgdGhpcy5wcm9qZWN0RGlyID0gcHJvamVjdERpcjtcbiAgICB0aGlzLndlYnBhY2tEaXIgPSBwYXRoLnJlc29sdmUocHJvamVjdERpciwgJy53ZWJwYWNrJyk7XG4gICAgdGhpcy5pc1Byb2QgPSBpc1Byb2Q7XG4gICAgdGhpcy5wb3J0ID0gcG9ydDtcblxuICAgIGQoJ0NvbmZpZyBtb2RlOicsIHRoaXMubW9kZSk7XG4gIH1cblxuICBhc3luYyByZXNvbHZlQ29uZmlnKGNvbmZpZzogQ29uZmlndXJhdGlvbiB8IENvbmZpZ3VyYXRpb25GYWN0b3J5IHwgc3RyaW5nKTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiB7XG4gICAgY29uc3QgcmF3Q29uZmlnID1cbiAgICAgIHR5cGVvZiBjb25maWcgPT09ICdzdHJpbmcnXG4gICAgICAgID8gLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGltcG9ydC9uby1keW5hbWljLXJlcXVpcmUsIGdsb2JhbC1yZXF1aXJlLCBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tdmFyLXJlcXVpcmVzXG4gICAgICAgICAgKHJlcXVpcmUocGF0aC5yZXNvbHZlKHRoaXMucHJvamVjdERpciwgY29uZmlnKSkgYXMgQ29uZmlndXJhdGlvbiB8IENvbmZpZ3VyYXRpb25GYWN0b3J5KVxuICAgICAgICA6IGNvbmZpZztcblxuICAgIHJldHVybiBwcm9jZXNzQ29uZmlnKHRoaXMucHJlcHJvY2Vzc0NvbmZpZywgcmF3Q29uZmlnKTtcbiAgfVxuXG4gIC8vIFVzZXJzIGNhbiBvdmVycmlkZSB0aGlzIG1ldGhvZCBpbiBhIHN1YmNsYXNzIHRvIHByb3ZpZGUgY3VzdG9tIGxvZ2ljIG9yXG4gIC8vIGNvbmZpZ3VyYXRpb24gcGFyYW1ldGVycy5cbiAgcHJlcHJvY2Vzc0NvbmZpZyA9IGFzeW5jIChjb25maWc6IENvbmZpZ3VyYXRpb25GYWN0b3J5KTogUHJvbWlzZTxDb25maWd1cmF0aW9uPiA9PlxuICAgIGNvbmZpZyhcbiAgICAgIHt9LFxuICAgICAge1xuICAgICAgICBtb2RlOiB0aGlzLm1vZGUsXG4gICAgICB9XG4gICAgKTtcblxuICBnZXQgbW9kZSgpOiBXZWJwYWNrTW9kZSB7XG4gICAgcmV0dXJuIHRoaXMuaXNQcm9kID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JztcbiAgfVxuXG4gIGdldCByZW5kZXJlclNvdXJjZU1hcE9wdGlvbigpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLmlzUHJvZCA/ICdzb3VyY2UtbWFwJyA6ICdldmFsLXNvdXJjZS1tYXAnO1xuICB9XG5cbiAgcmVuZGVyZXJUYXJnZXQoZW50cnlQb2ludDogV2VicGFja1BsdWdpbkVudHJ5UG9pbnQpOiBzdHJpbmcge1xuICAgIHJldHVybiBlbnRyeVBvaW50Lm5vZGVJbnRlZ3JhdGlvbiA/PyB0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5ub2RlSW50ZWdyYXRpb24gPyAnZWxlY3Ryb24tcmVuZGVyZXInIDogJ3dlYic7XG4gIH1cblxuICByZW5kZXJlckVudHJ5UG9pbnQoZW50cnlQb2ludDogV2VicGFja1BsdWdpbkVudHJ5UG9pbnQsIGluUmVuZGVyZXJEaXI6IGJvb2xlYW4sIGJhc2VuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLmlzUHJvZCkge1xuICAgICAgcmV0dXJuIGBcXGBmaWxlOi8vJFxce3JlcXVpcmUoJ3BhdGgnKS5yZXNvbHZlKF9fZGlybmFtZSwgJy4uJywgJyR7aW5SZW5kZXJlckRpciA/ICdyZW5kZXJlcicgOiAnLid9JywgJyR7ZW50cnlQb2ludC5uYW1lfScsICcke2Jhc2VuYW1lfScpfVxcYGA7XG4gICAgfVxuICAgIGNvbnN0IGJhc2VVcmwgPSBgaHR0cDovL2xvY2FsaG9zdDoke3RoaXMucG9ydH0vJHtlbnRyeVBvaW50Lm5hbWV9YDtcbiAgICBpZiAoYmFzZW5hbWUgIT09ICdpbmRleC5odG1sJykge1xuICAgICAgcmV0dXJuIGAnJHtiYXNlVXJsfS8ke2Jhc2VuYW1lfSdgO1xuICAgIH1cbiAgICByZXR1cm4gYCcke2Jhc2VVcmx9J2A7XG4gIH1cblxuICB0b0Vudmlyb25tZW50VmFyaWFibGUoZW50cnlQb2ludDogV2VicGFja1BsdWdpbkVudHJ5UG9pbnQsIHByZWxvYWQgPSBmYWxzZSk6IHN0cmluZyB7XG4gICAgY29uc3Qgc3VmZml4ID0gcHJlbG9hZCA/ICdfUFJFTE9BRF9XRUJQQUNLX0VOVFJZJyA6ICdfV0VCUEFDS19FTlRSWSc7XG4gICAgcmV0dXJuIGAke2VudHJ5UG9pbnQubmFtZS50b1VwcGVyQ2FzZSgpLnJlcGxhY2UoLyAvZywgJ18nKX0ke3N1ZmZpeH1gO1xuICB9XG5cbiAgZ2V0UHJlbG9hZERlZmluZShlbnRyeVBvaW50OiBXZWJwYWNrUGx1Z2luRW50cnlQb2ludCk6IHN0cmluZyB7XG4gICAgaWYgKGVudHJ5UG9pbnQucHJlbG9hZCkge1xuICAgICAgaWYgKHRoaXMuaXNQcm9kKSB7XG4gICAgICAgIHJldHVybiBgcmVxdWlyZSgncGF0aCcpLnJlc29sdmUoX19kaXJuYW1lLCAnLi4vcmVuZGVyZXInLCAnJHtlbnRyeVBvaW50Lm5hbWV9JywgJ3ByZWxvYWQuanMnKWA7XG4gICAgICB9XG4gICAgICByZXR1cm4gYCcke3BhdGgucmVzb2x2ZSh0aGlzLndlYnBhY2tEaXIsICdyZW5kZXJlcicsIGVudHJ5UG9pbnQubmFtZSwgJ3ByZWxvYWQuanMnKS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpfSdgO1xuICAgIH1cbiAgICAvLyBJZiB0aGlzIGVudHJ5LXBvaW50IGhhcyBubyBjb25maWd1cmVkIHByZWxvYWQgc2NyaXB0IGp1c3QgbWFwIHRoaXMgY29uc3RhbnQgdG8gYHVuZGVmaW5lZGBcbiAgICAvLyBzbyB0aGF0IGFueSBjb2RlIHVzaW5nIGl0IHN0aWxsIHdvcmtzLiAgVGhpcyBtYWtlcyBxdWljay1zdGFydCAvIGRvY3Mgc2ltcGxlci5cbiAgICByZXR1cm4gJ3VuZGVmaW5lZCc7XG4gIH1cblxuICBnZXRTdGFuZGFsb25lUHJlbG9hZERlZmluZShlbnRyeVBvaW50OiBXZWJwYWNrUHJlbG9hZEVudHJ5UG9pbnQyKSB7XG4gICAgaWYgKHRoaXMuaXNQcm9kKSB7XG4gICAgICByZXR1cm4gYHJlcXVpcmUoJ3BhdGgnKS5yZXNvbHZlKF9fZGlybmFtZSwgJy4uL3JlbmRlcmVyJywgJyR7ZW50cnlQb2ludC5uYW1lfScsICdwcmVsb2FkLmpzJylgO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYCcke3BhdGgucmVzb2x2ZSh0aGlzLndlYnBhY2tEaXIsICdyZW5kZXJlcicsIGVudHJ5UG9pbnQubmFtZSwgJ3ByZWxvYWQuanMnKS5yZXBsYWNlKC9cXFxcL2csICdcXFxcXFxcXCcpfSdgO1xuICAgIH1cbiAgfVxuXG4gIGdldERlZmluZXMoaW5SZW5kZXJlckRpciA9IHRydWUpOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHtcbiAgICBjb25zdCBkZWZpbmVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgaWYgKCF0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5lbnRyeVBvaW50cyB8fCAhQXJyYXkuaXNBcnJheSh0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5lbnRyeVBvaW50cykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUmVxdWlyZWQgY29uZmlnIG9wdGlvbiBcInJlbmRlcmVyLmVudHJ5UG9pbnRzXCIgaGFzIG5vdCBiZWVuIGRlZmluZWQnKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBlbnRyeVBvaW50IG9mIHRoaXMucGx1Z2luQ29uZmlnLnJlbmRlcmVyLmVudHJ5UG9pbnRzKSB7XG4gICAgICBjb25zdCBlbnRyeUtleSA9IHRoaXMudG9FbnZpcm9ubWVudFZhcmlhYmxlKGVudHJ5UG9pbnQpO1xuICAgICAgaWYgKGVudHJ5UG9pbnQuaHRtbCkge1xuICAgICAgICBkZWZpbmVzW2VudHJ5S2V5XSA9IHRoaXMucmVuZGVyZXJFbnRyeVBvaW50KGVudHJ5UG9pbnQsIGluUmVuZGVyZXJEaXIsICdpbmRleC5odG1sJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkZWZpbmVzW2VudHJ5S2V5XSA9IHRoaXMucmVuZGVyZXJFbnRyeVBvaW50KGVudHJ5UG9pbnQsIGluUmVuZGVyZXJEaXIsICdpbmRleC5qcycpO1xuICAgICAgfVxuICAgICAgZGVmaW5lc1tgcHJvY2Vzcy5lbnYuJHtlbnRyeUtleX1gXSA9IGRlZmluZXNbZW50cnlLZXldO1xuXG4gICAgICBjb25zdCBwcmVsb2FkRGVmaW5lS2V5ID0gdGhpcy50b0Vudmlyb25tZW50VmFyaWFibGUoZW50cnlQb2ludCwgdHJ1ZSk7XG4gICAgICBkZWZpbmVzW3ByZWxvYWREZWZpbmVLZXldID0gdGhpcy5nZXRQcmVsb2FkRGVmaW5lKGVudHJ5UG9pbnQpO1xuICAgICAgZGVmaW5lc1tgcHJvY2Vzcy5lbnYuJHtwcmVsb2FkRGVmaW5lS2V5fWBdID0gZGVmaW5lc1twcmVsb2FkRGVmaW5lS2V5XTtcbiAgICB9XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheSh0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5wcmVsb2FkRW50cmllcykpIHtcbiAgICAgIGZvciAoY29uc3QgZW50cnlQb2ludCBvZiB0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5wcmVsb2FkRW50cmllcykge1xuICAgICAgICBjb25zdCBwcmVsb2FkRGVmaW5lS2V5ID0gdGhpcy50b0Vudmlyb25tZW50VmFyaWFibGUoZW50cnlQb2ludCwgdHJ1ZSk7XG4gICAgICAgIGRlZmluZXNbcHJlbG9hZERlZmluZUtleV0gPSB0aGlzLmdldFN0YW5kYWxvbmVQcmVsb2FkRGVmaW5lKGVudHJ5UG9pbnQpO1xuICAgICAgICBkZWZpbmVzW2Bwcm9jZXNzLmVudi4ke3ByZWxvYWREZWZpbmVLZXl9YF0gPSBkZWZpbmVzW3ByZWxvYWREZWZpbmVLZXldO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkZWZpbmVzO1xuICB9XG5cbiAgYXN5bmMgZ2V0TWFpbkNvbmZpZygpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgICBjb25zdCBtYWluQ29uZmlnID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29uZmlnKHRoaXMucGx1Z2luQ29uZmlnLm1haW5Db25maWcpO1xuXG4gICAgaWYgKCFtYWluQ29uZmlnLmVudHJ5KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVpcmVkIG9wdGlvbiBcIm1haW5Db25maWcuZW50cnlcIiBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xuICAgIH1cbiAgICBjb25zdCBmaXggPSAoaXRlbTogRW50cnlUeXBlKTogRW50cnlUeXBlID0+IHtcbiAgICAgIGlmICh0eXBlb2YgaXRlbSA9PT0gJ3N0cmluZycpIHJldHVybiAoZml4KFtpdGVtXSkgYXMgc3RyaW5nW10pWzBdO1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoaXRlbSkpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0ubWFwKCh2YWwpID0+ICh2YWwuc3RhcnRzV2l0aCgnLi8nKSA/IHBhdGgucmVzb2x2ZSh0aGlzLnByb2plY3REaXIsIHZhbCkgOiB2YWwpKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHJldDogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgc3RyaW5nW10+ID0ge307XG4gICAgICBmb3IgKGNvbnN0IGtleSBvZiBPYmplY3Qua2V5cyhpdGVtKSkge1xuICAgICAgICByZXRba2V5XSA9IGZpeChpdGVtW2tleV0pIGFzIHN0cmluZyB8IHN0cmluZ1tdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9O1xuICAgIG1haW5Db25maWcuZW50cnkgPSBmaXgobWFpbkNvbmZpZy5lbnRyeSBhcyBFbnRyeVR5cGUpO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZShcbiAgICAgIHtcbiAgICAgICAgZGV2dG9vbDogJ3NvdXJjZS1tYXAnLFxuICAgICAgICB0YXJnZXQ6ICdlbGVjdHJvbi1tYWluJyxcbiAgICAgICAgbW9kZTogdGhpcy5tb2RlLFxuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBwYXRoOiBwYXRoLnJlc29sdmUodGhpcy53ZWJwYWNrRGlyLCAnbWFpbicpLFxuICAgICAgICAgIGZpbGVuYW1lOiAnaW5kZXguanMnLFxuICAgICAgICAgIGxpYnJhcnlUYXJnZXQ6ICdjb21tb25qczInLFxuICAgICAgICB9LFxuICAgICAgICBwbHVnaW5zOiBbbmV3IHdlYnBhY2suRGVmaW5lUGx1Z2luKHRoaXMuZ2V0RGVmaW5lcygpKV0sXG4gICAgICAgIG5vZGU6IHtcbiAgICAgICAgICBfX2Rpcm5hbWU6IGZhbHNlLFxuICAgICAgICAgIF9fZmlsZW5hbWU6IGZhbHNlLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIG1haW5Db25maWcgfHwge31cbiAgICApO1xuICB9XG5cbiAgYXN5bmMgZ2V0U3RhbmRhbG9uZVByZWxvYWRDb25maWcoZW50cnlQb2ludDogV2VicGFja1ByZWxvYWRFbnRyeVBvaW50Mikge1xuICAgIGNvbnN0IHJlbmRlcmVyQ29uZmlnID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29uZmlnKGVudHJ5UG9pbnQuY29uZmlnIHx8IHRoaXMucGx1Z2luQ29uZmlnLnJlbmRlcmVyLmNvbmZpZyk7XG4gICAgY29uc3QgcHJlZml4ZWRFbnRyaWVzID0gZW50cnlQb2ludC5wcmVmaXhlZEVudHJpZXMgfHwgW107XG5cbiAgICByZXR1cm4gd2VicGFja01lcmdlKFxuICAgICAge1xuICAgICAgICBkZXZ0b29sOiB0aGlzLnJlbmRlcmVyU291cmNlTWFwT3B0aW9uLFxuICAgICAgICBtb2RlOiB0aGlzLm1vZGUsXG4gICAgICAgIGVudHJ5OiBwcmVmaXhlZEVudHJpZXMuY29uY2F0KFtlbnRyeVBvaW50LmpzXSksXG4gICAgICAgIG91dHB1dDoge1xuICAgICAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZSh0aGlzLndlYnBhY2tEaXIsICdyZW5kZXJlcicsIGVudHJ5UG9pbnQubmFtZSksXG4gICAgICAgICAgZmlsZW5hbWU6ICdwcmVsb2FkLmpzJyxcbiAgICAgICAgfSxcbiAgICAgICAgbm9kZToge1xuICAgICAgICAgIF9fZGlybmFtZTogZmFsc2UsXG4gICAgICAgICAgX19maWxlbmFtZTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcmVuZGVyZXJDb25maWcgfHwge30sXG4gICAgICB7IHRhcmdldDogJ2VsZWN0cm9uLXByZWxvYWQnIH1cbiAgICApO1xuICB9XG5cbiAgYXN5bmMgZ2V0UHJlbG9hZENvbmZpZ0ZvckVudHJ5UG9pbnQocGFyZW50UG9pbnQ6IFdlYnBhY2tQbHVnaW5FbnRyeVBvaW50LCBlbnRyeVBvaW50OiBXZWJwYWNrUHJlbG9hZEVudHJ5UG9pbnQpOiBQcm9taXNlPENvbmZpZ3VyYXRpb24+IHtcbiAgICBjb25zdCByZW5kZXJlckNvbmZpZyA9IGF3YWl0IHRoaXMucmVzb2x2ZUNvbmZpZyhlbnRyeVBvaW50LmNvbmZpZyB8fCB0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5jb25maWcpO1xuICAgIGNvbnN0IHByZWZpeGVkRW50cmllcyA9IGVudHJ5UG9pbnQucHJlZml4ZWRFbnRyaWVzIHx8IFtdO1xuXG4gICAgcmV0dXJuIHdlYnBhY2tNZXJnZShcbiAgICAgIHtcbiAgICAgICAgZGV2dG9vbDogdGhpcy5yZW5kZXJlclNvdXJjZU1hcE9wdGlvbixcbiAgICAgICAgbW9kZTogdGhpcy5tb2RlLFxuICAgICAgICBlbnRyeTogcHJlZml4ZWRFbnRyaWVzLmNvbmNhdChbZW50cnlQb2ludC5qc10pLFxuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBwYXRoOiBwYXRoLnJlc29sdmUodGhpcy53ZWJwYWNrRGlyLCAncmVuZGVyZXInLCBwYXJlbnRQb2ludC5uYW1lKSxcbiAgICAgICAgICBmaWxlbmFtZTogJ3ByZWxvYWQuanMnLFxuICAgICAgICB9LFxuICAgICAgICBub2RlOiB7XG4gICAgICAgICAgX19kaXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICBfX2ZpbGVuYW1lOiBmYWxzZSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICByZW5kZXJlckNvbmZpZyB8fCB7fSxcbiAgICAgIHsgdGFyZ2V0OiAnZWxlY3Ryb24tcHJlbG9hZCcgfVxuICAgICk7XG4gIH1cblxuICBhc3luYyBnZXRSZW5kZXJlckNvbmZpZyhlbnRyeVBvaW50czogV2VicGFja1BsdWdpbkVudHJ5UG9pbnRbXSk6IFByb21pc2U8Q29uZmlndXJhdGlvbltdPiB7XG4gICAgY29uc3QgcmVuZGVyZXJDb25maWcgPSBhd2FpdCB0aGlzLnJlc29sdmVDb25maWcodGhpcy5wbHVnaW5Db25maWcucmVuZGVyZXIuY29uZmlnKTtcbiAgICBjb25zdCBkZWZpbmVzID0gdGhpcy5nZXREZWZpbmVzKGZhbHNlKTtcblxuICAgIHJldHVybiBlbnRyeVBvaW50cy5tYXAoKGVudHJ5UG9pbnQpID0+IHtcbiAgICAgIGNvbnN0IGNvbmZpZyA9IHdlYnBhY2tNZXJnZShcbiAgICAgICAge1xuICAgICAgICAgIGVudHJ5OiB7XG4gICAgICAgICAgICBbZW50cnlQb2ludC5uYW1lXTogKGVudHJ5UG9pbnQucHJlZml4ZWRFbnRyaWVzIHx8IFtdKS5jb25jYXQoW2VudHJ5UG9pbnQuanNdKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHRhcmdldDogdGhpcy5yZW5kZXJlclRhcmdldChlbnRyeVBvaW50KSxcbiAgICAgICAgICBkZXZ0b29sOiB0aGlzLnJlbmRlcmVyU291cmNlTWFwT3B0aW9uLFxuICAgICAgICAgIG1vZGU6IHRoaXMubW9kZSxcbiAgICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICAgIHBhdGg6IHBhdGgucmVzb2x2ZSh0aGlzLndlYnBhY2tEaXIsICdyZW5kZXJlcicpLFxuICAgICAgICAgICAgZmlsZW5hbWU6ICdbbmFtZV0vaW5kZXguanMnLFxuICAgICAgICAgICAgZ2xvYmFsT2JqZWN0OiAnc2VsZicsXG4gICAgICAgICAgICAuLi4odGhpcy5pc1Byb2QgPyB7fSA6IHsgcHVibGljUGF0aDogJy8nIH0pLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgbm9kZToge1xuICAgICAgICAgICAgX19kaXJuYW1lOiBmYWxzZSxcbiAgICAgICAgICAgIF9fZmlsZW5hbWU6IGZhbHNlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcGx1Z2luczogW1xuICAgICAgICAgICAgLi4uKGVudHJ5UG9pbnQuaHRtbFxuICAgICAgICAgICAgICA/IFtcbiAgICAgICAgICAgICAgICAgIG5ldyBIdG1sV2VicGFja1BsdWdpbih7XG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiBlbnRyeVBvaW50Lm5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlOiBlbnRyeVBvaW50Lmh0bWwsXG4gICAgICAgICAgICAgICAgICAgIGZpbGVuYW1lOiBgJHtlbnRyeVBvaW50Lm5hbWV9L2luZGV4Lmh0bWxgLFxuICAgICAgICAgICAgICAgICAgICBjaHVua3M6IFtlbnRyeVBvaW50Lm5hbWVdLmNvbmNhdChlbnRyeVBvaW50LmFkZGl0aW9uYWxDaHVua3MgfHwgW10pLFxuICAgICAgICAgICAgICAgICAgfSkgYXMgV2VicGFja1BsdWdpbkluc3RhbmNlLFxuICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgOiBbXSksXG4gICAgICAgICAgICBuZXcgd2VicGFjay5EZWZpbmVQbHVnaW4oZGVmaW5lcyksXG4gICAgICAgICAgICBuZXcgQXNzZXRSZWxvY2F0b3JQYXRjaCh0aGlzLmlzUHJvZCwgISF0aGlzLnBsdWdpbkNvbmZpZy5yZW5kZXJlci5ub2RlSW50ZWdyYXRpb24pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICAgIHJlbmRlcmVyQ29uZmlnIHx8IHt9XG4gICAgICApO1xuXG4gICAgICByZXR1cm4gY29uZmlnO1xuICAgIH0pO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZCIsImRlYnVnIiwiV2VicGFja0NvbmZpZ0dlbmVyYXRvciIsInBsdWdpbkNvbmZpZyIsInByb2plY3REaXIiLCJpc1Byb2QiLCJwb3J0IiwicHJlcHJvY2Vzc0NvbmZpZyIsImNvbmZpZyIsIm1vZGUiLCJ3ZWJwYWNrRGlyIiwicGF0aCIsInJlc29sdmUiLCJyZXNvbHZlQ29uZmlnIiwicmF3Q29uZmlnIiwicmVxdWlyZSIsInByb2Nlc3NDb25maWciLCJyZW5kZXJlclNvdXJjZU1hcE9wdGlvbiIsInJlbmRlcmVyVGFyZ2V0IiwiZW50cnlQb2ludCIsIm5vZGVJbnRlZ3JhdGlvbiIsInJlbmRlcmVyIiwicmVuZGVyZXJFbnRyeVBvaW50IiwiaW5SZW5kZXJlckRpciIsImJhc2VuYW1lIiwibmFtZSIsImJhc2VVcmwiLCJ0b0Vudmlyb25tZW50VmFyaWFibGUiLCJwcmVsb2FkIiwic3VmZml4IiwidG9VcHBlckNhc2UiLCJyZXBsYWNlIiwiZ2V0UHJlbG9hZERlZmluZSIsImdldFN0YW5kYWxvbmVQcmVsb2FkRGVmaW5lIiwiZ2V0RGVmaW5lcyIsImRlZmluZXMiLCJlbnRyeVBvaW50cyIsIkFycmF5IiwiaXNBcnJheSIsIkVycm9yIiwiZW50cnlLZXkiLCJodG1sIiwicHJlbG9hZERlZmluZUtleSIsInByZWxvYWRFbnRyaWVzIiwiZ2V0TWFpbkNvbmZpZyIsIm1haW5Db25maWciLCJlbnRyeSIsImZpeCIsIml0ZW0iLCJtYXAiLCJ2YWwiLCJzdGFydHNXaXRoIiwicmV0Iiwia2V5IiwiT2JqZWN0Iiwia2V5cyIsIndlYnBhY2tNZXJnZSIsImRldnRvb2wiLCJ0YXJnZXQiLCJvdXRwdXQiLCJmaWxlbmFtZSIsImxpYnJhcnlUYXJnZXQiLCJwbHVnaW5zIiwid2VicGFjayIsIkRlZmluZVBsdWdpbiIsIm5vZGUiLCJfX2Rpcm5hbWUiLCJfX2ZpbGVuYW1lIiwiZ2V0U3RhbmRhbG9uZVByZWxvYWRDb25maWciLCJyZW5kZXJlckNvbmZpZyIsInByZWZpeGVkRW50cmllcyIsImNvbmNhdCIsImpzIiwiZ2V0UHJlbG9hZENvbmZpZ0ZvckVudHJ5UG9pbnQiLCJwYXJlbnRQb2ludCIsImdldFJlbmRlcmVyQ29uZmlnIiwiZ2xvYmFsT2JqZWN0IiwicHVibGljUGF0aCIsIkh0bWxXZWJwYWNrUGx1Z2luIiwidGl0bGUiLCJ0ZW1wbGF0ZSIsImNodW5rcyIsImFkZGl0aW9uYWxDaHVua3MiLCJBc3NldFJlbG9jYXRvclBhdGNoIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFrQixHQUFPLENBQVAsTUFBTztBQUNLLEdBQXFCLENBQXJCLGtCQUFxQjtBQUNsQyxHQUFNLENBQU4sS0FBTTtBQUN1QyxHQUFTLENBQVQsUUFBUztBQUNqQyxHQUFlLENBQWYsYUFBZTtBQUVyQixHQUE0QixDQUE1QixvQkFBNEI7QUFDbEMsR0FBc0IsQ0FBdEIsY0FBc0I7Ozs7OztBQUtoRCxLQUFLLENBQUNBLENBQUMsT0FBR0MsTUFBSyxVQUFDLENBQTZDO01BT3hDQyxzQkFBc0I7Z0JBVzdCQyxZQUFpQyxFQUFFQyxVQUFrQixFQUFFQyxNQUFlLEVBQUVDLElBQVksQ0FBRSxDQUFDO1FBb0JuRyxFQUEwRSxBQUExRSx3RUFBMEU7UUFDMUUsRUFBNEIsQUFBNUIsMEJBQTRCO1FBaENmLElBd1BkLENBdk5DQyxnQkFBZ0IsVUFBVUMsTUFBNEIsR0FDcERBLE1BQU0sQ0FDSixDQUFDLENBQUMsRUFDRixDQUFDO2dCQUNDQyxJQUFJLEVBQUUsSUFBSSxDQUFD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