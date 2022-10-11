"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = void 0;
class AssetRelocatorPatch {
    constructor(isProd, nodeIntegration){
        this.isProd = isProd;
        this.nodeIntegration = nodeIntegration;
    }
    injectedProductionDirnameCode() {
        if (this.nodeIntegration) {
            // In production the assets are found one directory up from
            // __dirname
            //
            // __dirname cannot be used directly until this PR lands
            // https://github.com/jantimon/html-webpack-plugin/pull/1650
            return 'require("path").resolve(require("path").dirname(__filename), "..")';
        }
        // If nodeIntegration is disabled, we replace __dirname
        // with an empty string so no error is thrown at runtime
        return '""';
    }
    apply(compiler) {
        compiler.hooks.compilation.tap('asset-relocator-forge-patch', (compilation)=>{
            // We intercept the Vercel loader code injection and replace __dirname with
            // code that works with Electron Forge
            //
            // Here is where the injection occurs:
            // https://github.com/vercel/webpack-asset-relocator-loader/blob/4710a018fc8fb64ad51efb368759616fb273618f/src/asset-relocator.js#L331-L339
            compilation.mainTemplate.hooks.requireExtensions.intercept({
                register: (tapInfo)=>{
                    if (tapInfo.name === 'asset-relocator-loader') {
                        const originalFn = tapInfo.fn;
                        tapInfo.fn = (source, chunk)=>{
                            const originalInjectCode = originalFn(source, chunk);
                            // Since this is not a public API of the Vercel loader, it could
                            // change on patch versions and break things.
                            //
                            // If the injected code changes substantially, we throw an error
                            if (!originalInjectCode.includes('__webpack_require__.ab = __dirname + ')) {
                                throw new Error('The installed version of @vercel/webpack-asset-relocator-loader does not appear to be compatible with Forge');
                            }
                            if (this.isProd) {
                                return originalInjectCode.replace('__dirname', this.injectedProductionDirnameCode());
                            }
                            return originalInjectCode.replace('__dirname', // In development, the app is loaded via webpack-dev-server
                            // so __dirname is useless because it points to Electron
                            // internal code. Instead we hard-code the absolute path to
                            // the webpack output.
                            JSON.stringify(compiler.options.output.path));
                        };
                    }
                    return tapInfo;
                }
            });
        });
    }
}
exports.default = AssetRelocatorPatch;

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy91dGlsL0Fzc2V0UmVsb2NhdG9yUGF0Y2gudHMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2h1bmssIENvbXBpbGVyIH0gZnJvbSAnd2VicGFjayc7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIEFzc2V0UmVsb2NhdG9yUGF0Y2gge1xuICBwcml2YXRlIHJlYWRvbmx5IGlzUHJvZDogYm9vbGVhbjtcblxuICBwcml2YXRlIHJlYWRvbmx5IG5vZGVJbnRlZ3JhdGlvbjogYm9vbGVhbjtcblxuICBjb25zdHJ1Y3Rvcihpc1Byb2Q6IGJvb2xlYW4sIG5vZGVJbnRlZ3JhdGlvbjogYm9vbGVhbikge1xuICAgIHRoaXMuaXNQcm9kID0gaXNQcm9kO1xuICAgIHRoaXMubm9kZUludGVncmF0aW9uID0gbm9kZUludGVncmF0aW9uO1xuICB9XG5cbiAgcHJpdmF0ZSBpbmplY3RlZFByb2R1Y3Rpb25EaXJuYW1lQ29kZSgpOiBzdHJpbmcge1xuICAgIGlmICh0aGlzLm5vZGVJbnRlZ3JhdGlvbikge1xuICAgICAgLy8gSW4gcHJvZHVjdGlvbiB0aGUgYXNzZXRzIGFyZSBmb3VuZCBvbmUgZGlyZWN0b3J5IHVwIGZyb21cbiAgICAgIC8vIF9fZGlybmFtZVxuICAgICAgLy9cbiAgICAgIC8vIF9fZGlybmFtZSBjYW5ub3QgYmUgdXNlZCBkaXJlY3RseSB1bnRpbCB0aGlzIFBSIGxhbmRzXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vamFudGltb24vaHRtbC13ZWJwYWNrLXBsdWdpbi9wdWxsLzE2NTBcbiAgICAgIHJldHVybiAncmVxdWlyZShcInBhdGhcIikucmVzb2x2ZShyZXF1aXJlKFwicGF0aFwiKS5kaXJuYW1lKF9fZmlsZW5hbWUpLCBcIi4uXCIpJztcbiAgICB9XG5cbiAgICAvLyBJZiBub2RlSW50ZWdyYXRpb24gaXMgZGlzYWJsZWQsIHdlIHJlcGxhY2UgX19kaXJuYW1lXG4gICAgLy8gd2l0aCBhbiBlbXB0eSBzdHJpbmcgc28gbm8gZXJyb3IgaXMgdGhyb3duIGF0IHJ1bnRpbWVcbiAgICByZXR1cm4gJ1wiXCInO1xuICB9XG5cbiAgcHVibGljIGFwcGx5KGNvbXBpbGVyOiBDb21waWxlcik6IHZvaWQge1xuICAgIGNvbXBpbGVyLmhvb2tzLmNvbXBpbGF0aW9uLnRhcCgnYXNzZXQtcmVsb2NhdG9yLWZvcmdlLXBhdGNoJywgKGNvbXBpbGF0aW9uKSA9PiB7XG4gICAgICAvLyBXZSBpbnRlcmNlcHQgdGhlIFZlcmNlbCBsb2FkZXIgY29kZSBpbmplY3Rpb24gYW5kIHJlcGxhY2UgX19kaXJuYW1lIHdpdGhcbiAgICAgIC8vIGNvZGUgdGhhdCB3b3JrcyB3aXRoIEVsZWN0cm9uIEZvcmdlXG4gICAgICAvL1xuICAgICAgLy8gSGVyZSBpcyB3aGVyZSB0aGUgaW5qZWN0aW9uIG9jY3VyczpcbiAgICAgIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS92ZXJjZWwvd2VicGFjay1hc3NldC1yZWxvY2F0b3ItbG9hZGVyL2Jsb2IvNDcxMGEwMThmYzhmYjY0YWQ1MWVmYjM2ODc1OTYxNmZiMjczNjE4Zi9zcmMvYXNzZXQtcmVsb2NhdG9yLmpzI0wzMzEtTDMzOVxuICAgICAgY29tcGlsYXRpb24ubWFpblRlbXBsYXRlLmhvb2tzLnJlcXVpcmVFeHRlbnNpb25zLmludGVyY2VwdCh7XG4gICAgICAgIHJlZ2lzdGVyOiAodGFwSW5mbykgPT4ge1xuICAgICAgICAgIGlmICh0YXBJbmZvLm5hbWUgPT09ICdhc3NldC1yZWxvY2F0b3ItbG9hZGVyJykge1xuICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxGbiA9IHRhcEluZm8uZm4gYXMgKHNvdXJjZTogc3RyaW5nLCBjaHVuazogQ2h1bmspID0+IHN0cmluZztcblxuICAgICAgICAgICAgdGFwSW5mby5mbiA9IChzb3VyY2U6IHN0cmluZywgY2h1bms6IENodW5rKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsSW5qZWN0Q29kZSA9IG9yaWdpbmFsRm4oc291cmNlLCBjaHVuayk7XG5cbiAgICAgICAgICAgICAgLy8gU2luY2UgdGhpcyBpcyBub3QgYSBwdWJsaWMgQVBJIG9mIHRoZSBWZXJjZWwgbG9hZGVyLCBpdCBjb3VsZFxuICAgICAgICAgICAgICAvLyBjaGFuZ2Ugb24gcGF0Y2ggdmVyc2lvbnMgYW5kIGJyZWFrIHRoaW5ncy5cbiAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgLy8gSWYgdGhlIGluamVjdGVkIGNvZGUgY2hhbmdlcyBzdWJzdGFudGlhbGx5LCB3ZSB0aHJvdyBhbiBlcnJvclxuICAgICAgICAgICAgICBpZiAoIW9yaWdpbmFsSW5qZWN0Q29kZS5pbmNsdWRlcygnX193ZWJwYWNrX3JlcXVpcmVfXy5hYiA9IF9fZGlybmFtZSArICcpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdUaGUgaW5zdGFsbGVkIHZlcnNpb24gb2YgQHZlcmNlbC93ZWJwYWNrLWFzc2V0LXJlbG9jYXRvci1sb2FkZXIgZG9lcyBub3QgYXBwZWFyIHRvIGJlIGNvbXBhdGlibGUgd2l0aCBGb3JnZScpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgaWYgKHRoaXMuaXNQcm9kKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsSW5qZWN0Q29kZS5yZXBsYWNlKCdfX2Rpcm5hbWUnLCB0aGlzLmluamVjdGVkUHJvZHVjdGlvbkRpcm5hbWVDb2RlKCkpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgcmV0dXJuIG9yaWdpbmFsSW5qZWN0Q29kZS5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICdfX2Rpcm5hbWUnLFxuICAgICAgICAgICAgICAgIC8vIEluIGRldmVsb3BtZW50LCB0aGUgYXBwIGlzIGxvYWRlZCB2aWEgd2VicGFjay1kZXYtc2VydmVyXG4gICAgICAgICAgICAgICAgLy8gc28gX19kaXJuYW1lIGlzIHVzZWxlc3MgYmVjYXVzZSBpdCBwb2ludHMgdG8gRWxlY3Ryb25cbiAgICAgICAgICAgICAgICAvLyBpbnRlcm5hbCBjb2RlLiBJbnN0ZWFkIHdlIGhhcmQtY29kZSB0aGUgYWJzb2x1dGUgcGF0aCB0b1xuICAgICAgICAgICAgICAgIC8vIHRoZSB3ZWJwYWNrIG91dHB1dC5cbiAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShjb21waWxlci5vcHRpb25zLm91dHB1dC5wYXRoKVxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXR1cm4gdGFwSW5mbztcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iXSwibmFtZXMiOlsiQXNzZXRSZWxvY2F0b3JQYXRjaCIsImlzUHJvZCIsIm5vZGVJbnRlZ3JhdGlvbiIsImluamVjdGVkUHJvZHVjdGlvbkRpcm5hbWVDb2RlIiwiYXBwbHkiLCJjb21waWxlciIsImhvb2tzIiwiY29tcGlsYXRpb24iLCJ0YXAiLCJtYWluVGVtcGxhdGUiLCJyZXF1aXJlRXh0ZW5zaW9ucyIsImludGVyY2VwdCIsInJlZ2lzdGVyIiwidGFwSW5mbyIsIm5hbWUiLCJvcmlnaW5hbEZuIiwiZm4iLCJzb3VyY2UiLCJjaHVuayIsIm9yaWdpbmFsSW5qZWN0Q29kZSIsImluY2x1ZGVzIiwiRXJyb3IiLCJyZXBsYWNlIiwiSlNPTiIsInN0cmluZ2lmeSIsIm9wdGlvbnMiLCJvdXRwdXQiLCJwYXRoIl0sIm1hcHBpbmdzIjoiOzs7OztNQUVxQkEsbUJBQW1CO2dCQUsxQkMsTUFBZSxFQUFFQyxlQUF3QixDQUFFLENBQUM7UUFDdEQsSUFBSSxDQUFDRCxNQUFNLEdBQUdBLE1BQU07UUFDcEIsSUFBSSxDQUFDQyxlQUFlLEdBQUdBLGVBQWU7SUFDeEMsQ0FBQztJQUVPQyw2QkFBNkIsR0FBVyxDQUFDO1FBQy9DLEVBQUUsRUFBRSxJQUFJLENBQUNELGVBQWUsRUFBRSxDQUFDO1lBQ3pCLEVBQTJELEFBQTNELHlEQUEyRDtZQUMzRCxFQUFZLEFBQVosVUFBWTtZQUNaLEVBQUU7WUFDRixFQUF3RCxBQUF4RCxzREFBd0Q7WUFDeEQsRUFBNEQsQUFBNUQsMERBQTREO1lBQzVELE1BQU0sQ0FBQyxDQUFvRTtRQUM3RSxDQUFDO1FBRUQsRUFBdUQsQUFBdkQscURBQXVEO1FBQ3ZELEVBQXdELEFBQXhELHNEQUF3RDtRQUN4RCxNQUFNLENBQUMsQ0FBSTtJQUNiLENBQUM7SUFFTUUsS0FBSyxDQUFDQyxRQUFrQixFQUFRLENBQUM7UUFDdENBLFFBQVEsQ0FBQ0MsS0FBSyxDQUFDQyxXQUFXLENBQUNDLEdBQUcsQ0FBQyxDQUE2QiwrQkFBR0QsV0FBVyxHQUFLLENBQUM7WUFDOUUsRUFBMkUsQUFBM0UseUVBQTJFO1lBQzNFLEVBQXNDLEFBQXRDLG9DQUFzQztZQUN0QyxFQUFFO1lBQ0YsRUFBc0MsQUFBdEMsb0NBQXNDO1lBQ3RDLEVBQTBJLEFBQTFJLHdJQUEwSTtZQUMxSUEsV0FBVyxDQUFDRSxZQUFZLENBQUNILEtBQUssQ0FBQ0ksaUJBQWlCLENBQUNDLFNBQVMsQ0FBQyxDQUFDO2dCQUMxREMsUUFBUSxHQUFHQyxPQUFPLEdBQUssQ0FBQztvQkFDdEIsRUFBRSxFQUFFQSxPQUFPLENBQUNDLElBQUksS0FBSyxDQUF3Qix5QkFBRSxDQUFDO3dCQUM5QyxLQUFLLENBQUNDLFVBQVUsR0FBR0YsT0FBTyxDQUFDRyxFQUFFO3dCQUU3QkgsT0FBTyxDQUFDRyxFQUFFLElBQUlDLE1BQWMsRUFBRUMsS0FBWSxHQUFLLENBQUM7NEJBQzlDLEtBQUssQ0FBQ0Msa0JBQWtCLEdBQUdKLFVBQVUsQ0FBQ0UsTUFBTSxFQUFFQyxLQUFLOzRCQUVuRCxFQUFnRSxBQUFoRSw4REFBZ0U7NEJBQ2hFLEVBQTZDLEFBQTdDLDJDQUE2Qzs0QkFDN0MsRUFBRTs0QkFDRixFQUFnRSxBQUFoRSw4REFBZ0U7NEJBQ2hFLEVBQUUsR0FBR0Msa0JBQWtCLENBQUNDLFFBQVEsQ0FBQyxDQUF1Qyx5Q0FBRyxDQUFDO2dDQUMxRSxLQUFLLENBQUMsR0FBRyxDQUFDQyxLQUFLLENBQUMsQ0FBNkc7NEJBQy9ILENBQUM7NEJBRUQsRUFBRSxFQUFFLElBQUksQ0FBQ3BCLE1BQU0sRUFBRSxDQUFDO2dDQUNoQixNQUFNLENBQUNrQixrQkFBa0IsQ0FBQ0csT0FBTyxDQUFDLENBQVcsWUFBRSxJQUFJLENBQUNuQiw2QkFBNkI7NEJBQ25GLENBQUM7NEJBRUQsTUFBTSxDQUFDZ0Isa0JBQWtCLENBQUNHLE9BQU8sQ0FDL0IsQ0FBVyxZQUNYLEVBQTJELEFBQTNELHlEQUEyRDs0QkFDM0QsRUFBd0QsQUFBeEQsc0RBQXdEOzRCQUN4RCxFQUEyRCxBQUEzRCx5REFBMkQ7NEJBQzNELEVBQXNCLEFBQXRCLG9CQUFzQjs0QkFDdEJDLElBQUksQ0FBQ0MsU0FBUyxDQUFDbkIsUUFBUSxDQUFDb0IsT0FBTyxDQUFDQyxNQUFNLENBQUNDLElBQUk7d0JBRS9DLENBQUM7b0JBQ0gsQ0FBQztvQkFFRCxNQUFNLENBQUNkLE9BQU87Z0JBQ2hCLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztJQUNILENBQUM7O2tCQW5Fa0JiLG1CQUFtQiJ9