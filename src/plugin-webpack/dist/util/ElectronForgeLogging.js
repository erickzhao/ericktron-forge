"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
var _asyncOra = require("@electron-forge/async-ora");
var _once = _interopRequireDefault(require("./once"));
function _interopRequireDefault(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const pluginName = 'ElectronForgeLogging';
class LoggingPlugin {
    constructor(tab){
        this.tab = tab;
        this.promiseResolver = undefined;
        this.promiseRejector = undefined;
    }
    addRun() {
        if (this.promiseResolver) this.promiseResolver();
        (0, _asyncOra).asyncOra('Compiling Renderer Code', ()=>new Promise((resolve, reject)=>{
                const [onceResolve, onceReject] = (0, _once).default(resolve, reject);
                this.promiseResolver = onceResolve;
                this.promiseRejector = onceReject;
            })
        , ()=>{
        /* do not exit */ });
    }
    finishRun(error) {
        if (error && this.promiseRejector) this.promiseRejector(error);
        else if (this.promiseResolver) this.promiseResolver();
        this.promiseRejector = undefined;
        this.promiseResolver = undefined;
    }
    apply(compiler) {
        compiler.hooks.watchRun.tap(pluginName, (_compiler)=>{
            this.addRun();
        });
        compiler.hooks.done.tap(pluginName, (stats)=>{
            if (stats) {
                this.tab.log(stats.toString({
                    colors: true
                }));
                if (stats.hasErrors()) {
                    this.finishRun(stats.compilation.getErrors().toString());
                    return;
                }
            }
            this.finishRun();
        });
        compiler.hooks.failed.tap(pluginName, (err)=>this.finishRun(err.message)
        );
        compiler.hooks.infrastructureLog.tap(pluginName, (name, _type, args)=>{
            this.tab.log(`${name} - ${args.join(' ')}\n`);
            return true;
        });
    }
}
exports.default = LoggingPlugin;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL0VsZWN0cm9uRm9yZ2VMb2dnaW5nLnRzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGFzeW5jT3JhIH0gZnJvbSAnQGVsZWN0cm9uLWZvcmdlL2FzeW5jLW9yYSc7XG5pbXBvcnQgeyBUYWIgfSBmcm9tICdAZWxlY3Ryb24tZm9yZ2Uvd2ViLW11bHRpLWxvZ2dlcic7XG5pbXBvcnQgeyBDb21waWxlciB9IGZyb20gJ3dlYnBhY2snO1xuaW1wb3J0IG9uY2UgZnJvbSAnLi9vbmNlJztcblxuY29uc3QgcGx1Z2luTmFtZSA9ICdFbGVjdHJvbkZvcmdlTG9nZ2luZyc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIExvZ2dpbmdQbHVnaW4ge1xuICB0YWI6IFRhYjtcblxuICBwcm9taXNlUmVzb2x2ZXI6ICgoKSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25vLWV4cGxpY2l0LWFueVxuICBwcm9taXNlUmVqZWN0b3I6ICgocmVhc29uPzogYW55KSA9PiB2b2lkKSB8IHVuZGVmaW5lZDtcblxuICBjb25zdHJ1Y3Rvcih0YWI6IFRhYikge1xuICAgIHRoaXMudGFiID0gdGFiO1xuICAgIHRoaXMucHJvbWlzZVJlc29sdmVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMucHJvbWlzZVJlamVjdG9yID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgcHJpdmF0ZSBhZGRSdW4oKSB7XG4gICAgaWYgKHRoaXMucHJvbWlzZVJlc29sdmVyKSB0aGlzLnByb21pc2VSZXNvbHZlcigpO1xuICAgIGFzeW5jT3JhKFxuICAgICAgJ0NvbXBpbGluZyBSZW5kZXJlciBDb2RlJyxcbiAgICAgICgpID0+XG4gICAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBbb25jZVJlc29sdmUsIG9uY2VSZWplY3RdID0gb25jZShyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAgIHRoaXMucHJvbWlzZVJlc29sdmVyID0gb25jZVJlc29sdmU7XG4gICAgICAgICAgdGhpcy5wcm9taXNlUmVqZWN0b3IgPSBvbmNlUmVqZWN0O1xuICAgICAgICB9KSxcbiAgICAgICgpID0+IHtcbiAgICAgICAgLyogZG8gbm90IGV4aXQgKi9cbiAgICAgIH1cbiAgICApO1xuICB9XG5cbiAgcHJpdmF0ZSBmaW5pc2hSdW4oZXJyb3I/OiBzdHJpbmcpIHtcbiAgICBpZiAoZXJyb3IgJiYgdGhpcy5wcm9taXNlUmVqZWN0b3IpIHRoaXMucHJvbWlzZVJlamVjdG9yKGVycm9yKTtcbiAgICBlbHNlIGlmICh0aGlzLnByb21pc2VSZXNvbHZlcikgdGhpcy5wcm9taXNlUmVzb2x2ZXIoKTtcbiAgICB0aGlzLnByb21pc2VSZWplY3RvciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnByb21pc2VSZXNvbHZlciA9IHVuZGVmaW5lZDtcbiAgfVxuXG4gIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbXBpbGVyLmhvb2tzLndhdGNoUnVuLnRhcChwbHVnaW5OYW1lLCAoX2NvbXBpbGVyKSA9PiB7XG4gICAgICB0aGlzLmFkZFJ1bigpO1xuICAgIH0pO1xuICAgIGNvbXBpbGVyLmhvb2tzLmRvbmUudGFwKHBsdWdpbk5hbWUsIChzdGF0cykgPT4ge1xuICAgICAgaWYgKHN0YXRzKSB7XG4gICAgICAgIHRoaXMudGFiLmxvZyhcbiAgICAgICAgICBzdGF0cy50b1N0cmluZyh7XG4gICAgICAgICAgICBjb2xvcnM6IHRydWUsXG4gICAgICAgICAgfSlcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKHN0YXRzLmhhc0Vycm9ycygpKSB7XG4gICAgICAgICAgdGhpcy5maW5pc2hSdW4oc3RhdHMuY29tcGlsYXRpb24uZ2V0RXJyb3JzKCkudG9TdHJpbmcoKSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLmZpbmlzaFJ1bigpO1xuICAgIH0pO1xuICAgIGNvbXBpbGVyLmhvb2tzLmZhaWxlZC50YXAocGx1Z2luTmFtZSwgKGVycikgPT4gdGhpcy5maW5pc2hSdW4oZXJyLm1lc3NhZ2UpKTtcbiAgICBjb21waWxlci5ob29rcy5pbmZyYXN0cnVjdHVyZUxvZy50YXAocGx1Z2luTmFtZSwgKG5hbWU6IHN0cmluZywgX3R5cGU6IHN0cmluZywgYXJnczogc3RyaW5nW10pID0+IHtcbiAgICAgIHRoaXMudGFiLmxvZyhgJHtuYW1lfSAtICR7YXJncy5qb2luKCcgJyl9XFxuYCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9KTtcbiAgfVxufVxuIl0sIm5hbWVzIjpbInBsdWdpbk5hbWUiLCJMb2dnaW5nUGx1Z2luIiwidGFiIiwicHJvbWlzZVJlc29sdmVyIiwidW5kZWZpbmVkIiwicHJvbWlzZVJlamVjdG9yIiwiYWRkUnVuIiwiYXN5bmNPcmEiLCJQcm9taXNlIiwicmVzb2x2ZSIsInJlamVjdCIsIm9uY2VSZXNvbHZlIiwib25jZVJlamVjdCIsIm9uY2UiLCJmaW5pc2hSdW4iLCJlcnJvciIsImFwcGx5IiwiY29tcGlsZXIiLCJob29rcyIsIndhdGNoUnVuIiwidGFwIiwiX2NvbXBpbGVyIiwiZG9uZSIsInN0YXRzIiwibG9nIiwidG9TdHJpbmciLCJjb2xvcnMiLCJoYXNFcnJvcnMiLCJjb21waWxhdGlvbiIsImdldEVycm9ycyIsImZhaWxlZCIsImVyciIsIm1lc3NhZ2UiLCJpbmZyYXN0cnVjdHVyZUxvZyIsIm5hbWUiLCJfdHlwZSIsImFyZ3MiLCJqb2luIl0sIm1hcHBpbmdzIjoiOzs7OztBQUF5QixHQUEyQixDQUEzQixTQUEyQjtBQUduQyxHQUFRLENBQVIsS0FBUTs7Ozs7O0FBRXpCLEtBQUssQ0FBQ0EsVUFBVSxHQUFHLENBQXNCO01BRXBCQyxhQUFhO2dCQVFwQkMsR0FBUSxDQUFFLENBQUM7UUFDckIsSUFBSSxDQUFDQSxHQUFHLEdBQUdBLEdBQUc7UUFDZCxJQUFJ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