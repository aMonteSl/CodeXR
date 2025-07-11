"use strict";
/**
 * Central index file for XR analysis functionality
 * Provides a single import point for all XR analysis operations
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
// Core XR analysis manager
__exportStar(require("./xrAnalysisManager"), exports);
// Data transformation and formatting
__exportStar(require("./xrDataTransformer"), exports);
__exportStar(require("./xrDataFormatter"), exports);
// Template utilities
__exportStar(require("./xrTemplateUtils"), exports);
// Dimension mapping and chart templates
__exportStar(require("./dimensionMapping"), exports);
__exportStar(require("./chartTemplates"), exports);
//# sourceMappingURL=index.js.map