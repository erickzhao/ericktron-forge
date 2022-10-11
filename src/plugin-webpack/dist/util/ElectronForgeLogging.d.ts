import { Tab } from '@electron-forge/web-multi-logger';
import { Compiler } from 'webpack';
export default class LoggingPlugin {
    tab: Tab;
    promiseResolver: (() => void) | undefined;
    promiseRejector: ((reason?: any) => void) | undefined;
    constructor(tab: Tab);
    private addRun;
    private finishRun;
    apply(compiler: Compiler): void;
}
//# sourceMappingURL=ElectronForgeLogging.d.ts.map