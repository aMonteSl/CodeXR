"use strict";
/**
 * BabiaXR Templates System
 * Entry point for the chart template system
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateProcessor = exports.DimensionValidator = exports.BabiaChartRegistry = exports.chartTemplates = void 0;
// Export models
__exportStar(require("./models/chartModels"), exports);
// Export chart templates
var templateCharts_1 = require("./charts/templateCharts");
Object.defineProperty(exports, "chartTemplates", { enumerable: true, get: function () { return templateCharts_1.chartTemplates; } });
// Export registry
var chartRegistry_1 = require("./registry/chartRegistry");
Object.defineProperty(exports, "BabiaChartRegistry", { enumerable: true, get: function () { return chartRegistry_1.BabiaChartRegistry; } });
// Export processing utilities
var dimensionValidator_1 = require("./processing/dimensionValidator");
Object.defineProperty(exports, "DimensionValidator", { enumerable: true, get: function () { return dimensionValidator_1.DimensionValidator; } });
var templateProcessor_1 = require("./processing/templateProcessor");
Object.defineProperty(exports, "TemplateProcessor", { enumerable: true, get: function () { return templateProcessor_1.TemplateProcessor; } });
//# sourceMappingURL=index.js.map