"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectChartOptions = collectChartOptions;
exports.collectBarChartOptions = collectBarChartOptions;
exports.collectPieChartOptions = collectPieChartOptions;
const vscode = __importStar(require("vscode"));
const chartModel_1 = require("../models/chartModel");
/**
 * Collects chart-specific options based on chart type
 * @param chartType The type of chart
 * @returns Options object or undefined if cancelled
 */
async function collectChartOptions(chartType) {
    switch (chartType) {
        case chartModel_1.ChartType.BAR_CHART:
            return collectBarChartOptions();
        case chartModel_1.ChartType.PIE_CHART:
            return collectPieChartOptions();
        default:
            return {};
    }
}
/**
 * Collects options specific to bar charts
 * @returns Bar chart options
 */
async function collectBarChartOptions() {
    // Ask for horizontal orientation
    const horizontalResponse = await vscode.window.showQuickPick(['Vertical', 'Horizontal'], { placeHolder: 'Bar orientation' });
    if (!horizontalResponse)
        return undefined;
    return {
        horizontal: horizontalResponse === 'Horizontal',
        height: 1,
        width: 2
    };
}
/**
 * Collects options specific to pie charts
 * @returns Pie chart options
 */
async function collectPieChartOptions() {
    // Ask for donut style
    const donutResponse = await vscode.window.showQuickPick(['Standard Pie', 'Donut'], { placeHolder: 'Pie chart style' });
    if (!donutResponse)
        return undefined;
    return {
        size: 1.5,
        height: 0.2,
        donut: donutResponse === 'Donut',
        showLabels: true
    };
}
//# sourceMappingURL=optionsCollector.js.map