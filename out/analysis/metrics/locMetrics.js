"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.countLines = countLines;
/**
 * Counts blank lines and total lines in source code
 */
function countLines(sourceText) {
    // Split the text into lines
    const lines = sourceText.split(/\r?\n/);
    // Total lines is straightforward
    const total = lines.length;
    // Count blank lines - lines with only whitespace
    const blank = lines.filter(line => line.trim().length === 0).length;
    return {
        total,
        blank
    };
}
//# sourceMappingURL=locMetrics.js.map