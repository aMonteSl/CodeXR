"use strict";
// Legacy file - stub for backward compatibility
// The main chart generation is now handled by src/analysis/xr/chartTemplates.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTemplate = processTemplate;
async function processTemplate(context, chartSpec) {
    console.warn('Using deprecated template system');
    return {
        html: '<html><body>Deprecated chart system</body></html>',
        originalDataPath: '',
        isRemoteData: false
    };
}
//# sourceMappingURL=templateManager.js.map