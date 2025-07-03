"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countFileLines = exports.getLanguageName = exports.formatFileSize = exports.generateNonce = void 0;
exports.generateAnalysisId = generateAnalysisId;
exports.getCurrentTimestamp = getCurrentTimestamp;
exports.isValidFilePath = isValidFilePath;
exports.createAnalysisError = createAnalysisError;
const nonceUtils_1 = require("../../utils/nonceUtils");
Object.defineProperty(exports, "generateNonce", { enumerable: true, get: function () { return nonceUtils_1.generateNonce; } });
const analysisUtils_1 = require("./analysisUtils");
Object.defineProperty(exports, "formatFileSize", { enumerable: true, get: function () { return analysisUtils_1.formatFileSize; } });
Object.defineProperty(exports, "countFileLines", { enumerable: true, get: function () { return analysisUtils_1.countFileLines; } });
const languageUtils_1 = require("../../utils/languageUtils");
Object.defineProperty(exports, "getLanguageName", { enumerable: true, get: function () { return languageUtils_1.getLanguageName; } });
/**
 * Generate a unique identifier for analysis sessions
 */
function generateAnalysisId() {
    return `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
/**
 * Get current timestamp for analysis
 */
function getCurrentTimestamp() {
    return new Date().toLocaleString();
}
/**
 * Check if a path is a valid file path
 */
function isValidFilePath(filePath) {
    return typeof filePath === 'string' && filePath.length > 0 && !filePath.includes('\0');
}
/**
 * Create a formatted error message for analysis failures
 */
function createAnalysisError(operation, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `${operation} failed: ${errorMessage}`;
}
//# sourceMappingURL=generalUtils.js.map