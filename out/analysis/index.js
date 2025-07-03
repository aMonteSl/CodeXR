"use strict";
/**
 * Main analysis module index
 * This is the primary entry point for all analysis functionality in CodeXR
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
exports.analyzeClassCount = exports.analyzeComments = exports.analyzeLizard = exports.analyzeFileStatic = void 0;
// Core analysis functionality
__exportStar(require("./analysisManager"), exports);
// Data models
__exportStar(require("./model"), exports);
// Analysis modules - selective exports to avoid naming conflicts
var static_1 = require("./static");
Object.defineProperty(exports, "analyzeFileStatic", { enumerable: true, get: function () { return static_1.analyzeFileStatic; } });
Object.defineProperty(exports, "analyzeLizard", { enumerable: true, get: function () { return static_1.analyzeLizard; } });
Object.defineProperty(exports, "analyzeComments", { enumerable: true, get: function () { return static_1.analyzeComments; } });
Object.defineProperty(exports, "analyzeClassCount", { enumerable: true, get: function () { return static_1.analyzeClassCount; } });
__exportStar(require("./xr"), exports);
__exportStar(require("./html"), exports);
// Tree components
__exportStar(require("./tree"), exports);
// File watchers
__exportStar(require("./watchers"), exports);
// Utilities
__exportStar(require("./utils"), exports);
//# sourceMappingURL=index.js.map