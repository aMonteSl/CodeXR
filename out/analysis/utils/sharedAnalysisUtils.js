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
exports.createAnalysisVisualization = createAnalysisVisualization;
exports.copyStaticAnalysisAssets = copyStaticAnalysisAssets;
exports.updateVisualizationData = updateVisualizationData;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const index_1 = require("../static/index");
const nonceUtils_1 = require("../../utils/nonceUtils");
/**
 * Shared analysis utilities for both Static and XR analysis modes
 * This module contains common logic that was previously duplicated
 */
/**
 * Performs file analysis and creates visualization directory with data.json
 * @param filePath Path to the file to analyze
 * @param context VS Code extension context
 * @returns Object containing analysis result and visualization directory path
 */
async function createAnalysisVisualization(filePath, context) {
    try {
        console.log(`🔍 Starting analysis for: ${filePath}`);
        // Perform the actual file analysis (shared between static and XR)
        const analysisResult = await (0, index_1.analyzeFileStatic)(filePath, context);
        if (!analysisResult) {
            vscode.window.showErrorMessage('Failed to analyze file');
            return undefined;
        }
        const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
        const nonce = (0, nonceUtils_1.generateNonce)();
        // Create visualization directory
        const visualizationsDir = path.join(context.extensionPath, 'visualizations');
        try {
            await fs.mkdir(visualizationsDir, { recursive: true });
        }
        catch (e) {
            // Directory exists, continue
        }
        const visualizationDir = path.join(visualizationsDir, `${fileNameWithoutExt}_${nonce}`);
        await fs.mkdir(visualizationDir, { recursive: true });
        console.log(`📁 Created visualization directory: ${visualizationDir}`);
        // Save analysis data as JSON
        const dataFilePath = path.join(visualizationDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(analysisResult, null, 2));
        console.log(`💾 Saved analysis data: ${dataFilePath}`);
        return { analysisResult, visualizationDir };
    }
    catch (error) {
        console.error('Error creating analysis visualization:', error);
        vscode.window.showErrorMessage(`Analysis error: ${error instanceof Error ? error.message : String(error)}`);
        return undefined;
    }
}
/**
 * Copies static analysis template and assets to visualization directory
 * @param context VS Code extension context
 * @param visualizationDir Target directory for the files
 */
async function copyStaticAnalysisAssets(context, visualizationDir) {
    try {
        // Copy the HTML template
        const templatePath = path.join(context.extensionPath, 'templates', 'analysis', 'fileAnalysis.html');
        const htmlPath = path.join(visualizationDir, 'index.html');
        await fs.copyFile(templatePath, htmlPath);
        console.log(`📄 Copied HTML template: ${htmlPath}`);
        // Copy CSS file
        const cssSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysisstyle.css');
        const cssDestPath = path.join(visualizationDir, 'fileAnalysisstyle.css');
        await fs.copyFile(cssSourcePath, cssDestPath);
        console.log(`🎨 Copied CSS file: ${cssDestPath}`);
        // Copy JS file
        const jsSourcePath = path.join(context.extensionPath, 'media', 'analysis', 'fileAnalysismain.js');
        const jsDestPath = path.join(visualizationDir, 'fileAnalysismain.js');
        await fs.copyFile(jsSourcePath, jsDestPath);
        console.log(`⚡ Copied JS file: ${jsDestPath}`);
    }
    catch (error) {
        console.error('Error copying static analysis assets:', error);
        throw error;
    }
}
/**
 * Updates existing visualization data.json with new analysis results
 * @param visualizationDir Path to the visualization directory
 * @param analysisResult New analysis results
 */
async function updateVisualizationData(visualizationDir, analysisResult) {
    try {
        const dataFilePath = path.join(visualizationDir, 'data.json');
        await fs.writeFile(dataFilePath, JSON.stringify(analysisResult, null, 2));
        console.log(`🔄 Updated analysis data: ${dataFilePath}`);
    }
    catch (error) {
        console.error('Error updating visualization data:', error);
        throw error;
    }
}
//# sourceMappingURL=sharedAnalysisUtils.js.map