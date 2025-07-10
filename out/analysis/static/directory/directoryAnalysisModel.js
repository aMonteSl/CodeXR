"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexitySeverity = void 0;
exports.getComplexitySeverity = getComplexitySeverity;
exports.getSeverityColor = getSeverityColor;
/**
 * Complexity severity levels based on CCN
 */
var ComplexitySeverity;
(function (ComplexitySeverity) {
    ComplexitySeverity["LOW"] = "low";
    ComplexitySeverity["MEDIUM"] = "medium";
    ComplexitySeverity["HIGH"] = "high";
    ComplexitySeverity["CRITICAL"] = "critical"; // > 20
})(ComplexitySeverity || (exports.ComplexitySeverity = ComplexitySeverity = {}));
/**
 * Get complexity severity based on CCN value
 */
function getComplexitySeverity(ccn) {
    if (ccn <= 5) {
        return ComplexitySeverity.LOW;
    }
    if (ccn <= 10) {
        return ComplexitySeverity.MEDIUM;
    }
    if (ccn <= 20) {
        return ComplexitySeverity.HIGH;
    }
    return ComplexitySeverity.CRITICAL;
}
/**
 * Get severity color for UI display
 */
function getSeverityColor(severity) {
    switch (severity) {
        case ComplexitySeverity.LOW:
            return 'var(--complexity-low)';
        case ComplexitySeverity.MEDIUM:
            return 'var(--complexity-medium)';
        case ComplexitySeverity.HIGH:
            return 'var(--complexity-high)';
        case ComplexitySeverity.CRITICAL:
            return 'var(--complexity-critical)';
    }
}
//# sourceMappingURL=directoryAnalysisModel.js.map